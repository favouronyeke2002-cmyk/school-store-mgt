ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS client_transaction_id uuid,
  ADD COLUMN IF NOT EXISTS request_fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_client_transaction_id_key
  ON transactions (client_transaction_id)
  WHERE client_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION commit_cashier_checkout(
  p_client_transaction_id uuid,
  p_request jsonb,
  p_transaction jsonb,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_issuances jsonb DEFAULT '[]'::jsonb,
  p_stock_changes jsonb DEFAULT '[]'::jsonb,
  p_ledger_entries jsonb DEFAULT '[]'::jsonb,
  p_fee_update jsonb DEFAULT NULL,
  p_applicant_payment jsonb DEFAULT NULL,
  p_ledger_updates jsonb DEFAULT '[]'::jsonb,
  p_mark_applicant_eligible integer DEFAULT NULL,
  p_performed_by text DEFAULT 'Cashier'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_transaction transactions%ROWTYPE;
  new_transaction transactions%ROWTYPE;
  current_fee student_fees%ROWTYPE;
  fee_update_id integer;
  ledger_update jsonb;
  stock_change jsonb;
  fingerprint text := md5(p_request::text);
  student_balance numeric;
  active_session text;
  active_term text;
  affected_rows integer;
  parent_transaction transactions%ROWTYPE;
  current_bundle_balance numeric;
BEGIN
  IF p_client_transaction_id IS NULL THEN
    RAISE EXCEPTION 'A client transaction ID is required';
  END IF;

  SELECT * INTO existing_transaction
  FROM transactions
  WHERE client_transaction_id = p_client_transaction_id;

  IF FOUND THEN
    IF existing_transaction.request_fingerprint IS DISTINCT FROM fingerprint THEN
      RAISE EXCEPTION 'This idempotency key was already used for a different checkout';
    END IF;
    RETURN jsonb_build_object(
      'transaction_id', existing_transaction.transaction_id,
      'duplicate', true,
      'transaction', to_jsonb(existing_transaction)
    );
  END IF;

  IF NULLIF(p_transaction->>'student_id', '') IS NOT NULL THEN
    PERFORM 1
    FROM students
    WHERE student_id = p_transaction->>'student_id'
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Student record was not found';
    END IF;
  END IF;

  IF p_applicant_payment IS NOT NULL OR p_mark_applicant_eligible IS NOT NULL THEN
    IF p_applicant_payment IS NOT NULL
      AND (p_applicant_payment->>'applicant_id')::integer
        IS DISTINCT FROM NULLIF(p_transaction->>'applicant_id', '')::integer THEN
      RAISE EXCEPTION 'Applicant payment does not match the transaction owner';
    END IF;
    PERFORM 1
    FROM applicants
    WHERE id = COALESCE(
      NULLIF(p_applicant_payment->>'applicant_id', '')::integer,
      p_mark_applicant_eligible
    )
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Applicant record was not found';
    END IF;
  END IF;

  IF p_request->>'kind' = 'BUNDLE_BALANCE_PAYMENT' THEN
    SELECT * INTO parent_transaction
    FROM transactions
    WHERE transaction_id = (p_request->>'transactionId')::integer
    FOR UPDATE;
    IF NOT FOUND
      OR parent_transaction.student_id <> p_transaction->>'student_id'
      OR UPPER(COALESCE(parent_transaction.status, '')) = 'VOIDED' THEN
      RAISE EXCEPTION 'Registration balance is unavailable for payment';
    END IF;

    SELECT GREATEST(
      0,
      COALESCE(parent_transaction.balance_due, 0) - COALESCE(SUM(amount_paid), 0)
    )
    INTO current_bundle_balance
    FROM transactions
    WHERE student_id = parent_transaction.student_id
      AND notes ILIKE (
        '%Ref: Txn #' || parent_transaction.transaction_id || '; Append-only%'
      )
      AND UPPER(COALESCE(status, '')) <> 'VOIDED';

    IF (p_request->>'amount')::numeric > current_bundle_balance + 0.01 THEN
      RAISE EXCEPTION 'Registration balance changed during checkout. Refresh and retry.';
    END IF;
  END IF;

  INSERT INTO transactions (
    student_id, applicant_id, shift_id, type, amount_paid, payment_mode,
    notes, fee_type_id, bundle_id, customer_name, target_class, balance_due,
    academic_term, discount_amount, original_bill_amount,
    client_transaction_id, request_fingerprint
  ) VALUES (
    NULLIF(p_transaction->>'student_id', ''),
    NULLIF(p_transaction->>'applicant_id', '')::integer,
    (p_transaction->>'shift_id')::integer,
    p_transaction->>'type',
    COALESCE(NULLIF(p_transaction->>'amount_paid', '')::numeric, 0),
    p_transaction->>'payment_mode',
    p_transaction->>'notes',
    NULLIF(p_transaction->>'fee_type_id', '')::integer,
    NULLIF(p_transaction->>'bundle_id', '')::integer,
    p_transaction->>'customer_name',
    p_transaction->>'target_class',
    COALESCE(NULLIF(p_transaction->>'balance_due', '')::numeric, 0),
    p_transaction->>'academic_term',
    COALESCE(NULLIF(p_transaction->>'discount_amount', '')::numeric, 0),
    NULLIF(p_transaction->>'original_bill_amount', '')::numeric,
    p_client_transaction_id,
    fingerprint
  )
  ON CONFLICT (client_transaction_id)
    WHERE client_transaction_id IS NOT NULL
  DO NOTHING
  RETURNING * INTO new_transaction;

  IF NOT FOUND THEN
    SELECT * INTO existing_transaction
    FROM transactions
    WHERE client_transaction_id = p_client_transaction_id
    FOR UPDATE;
    IF existing_transaction.request_fingerprint IS DISTINCT FROM fingerprint THEN
      RAISE EXCEPTION 'This idempotency key was already used for a different checkout';
    END IF;
    RETURN jsonb_build_object(
      'transaction_id', existing_transaction.transaction_id,
      'duplicate', true,
      'transaction', to_jsonb(existing_transaction)
    );
  END IF;

  IF p_fee_update IS NOT NULL THEN
    fee_update_id := (p_fee_update->>'id')::integer;
    SELECT * INTO current_fee
    FROM student_fees
    WHERE id = fee_update_id
      AND student_id = p_transaction->>'student_id'
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The fee record was not found for this student';
    END IF;
    IF current_fee.amount_due <> (p_fee_update->>'expected_amount_due')::numeric
      OR current_fee.amount_paid <> (p_fee_update->>'expected_amount_paid')::numeric THEN
      RAISE EXCEPTION 'This fee balance changed during checkout. Refresh and retry.';
    END IF;

    UPDATE student_fees
    SET amount_due = (p_fee_update->>'amount_due')::numeric,
        amount_paid = (p_fee_update->>'amount_paid')::numeric,
        discount_amount = COALESCE(
          NULLIF(p_fee_update->>'discount_amount', '')::numeric,
          discount_amount
        )
    WHERE id = fee_update_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(p_issuances, '[]'::jsonb)) AS issuance(
      student_id text,
      applicant_id integer
    )
    WHERE (
      issuance.student_id IS NOT NULL
      AND issuance.student_id IS DISTINCT FROM NULLIF(p_transaction->>'student_id', '')
    )
    OR (
      issuance.applicant_id IS NOT NULL
      AND issuance.applicant_id IS DISTINCT FROM NULLIF(p_transaction->>'applicant_id', '')::integer
    )
  ) THEN
    RAISE EXCEPTION 'Fulfillment records do not match the transaction owner';
  END IF;

  INSERT INTO transaction_items (
    transaction_id, item_id, item_name, quantity, unit_price, total_price
  )
  SELECT
    new_transaction.transaction_id,
    item.item_id,
    item.item_name,
    item.quantity,
    item.unit_price,
    item.total_price
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS item(
    item_id integer,
    item_name text,
    quantity integer,
    unit_price numeric,
    total_price numeric
  );

  FOR stock_change IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_stock_changes, '[]'::jsonb))
  LOOP
    PERFORM change_inventory_stock(
      (stock_change->>'item_id')::integer,
      -ABS((stock_change->>'quantity')::integer),
      'SALE',
      COALESCE(stock_change->>'notes', 'Cashier checkout #' || new_transaction.transaction_id),
      COALESCE(NULLIF(p_performed_by, ''), 'Cashier')
    );
  END LOOP;

  INSERT INTO student_book_issuances (
    student_id, applicant_id, transaction_id, item_id, book_name, item_name,
    bundle_name, quantity, status, stock_deducted
  )
  SELECT
    NULLIF(issuance.student_id, ''),
    issuance.applicant_id,
    new_transaction.transaction_id,
    issuance.item_id,
    issuance.book_name,
    issuance.item_name,
    issuance.bundle_name,
    issuance.quantity,
    issuance.status,
    issuance.stock_deducted
  FROM jsonb_to_recordset(COALESCE(p_issuances, '[]'::jsonb)) AS issuance(
    student_id text,
    applicant_id integer,
    item_id integer,
    book_name text,
    item_name text,
    bundle_name text,
    quantity integer,
    status text,
    stock_deducted boolean
  );

  INSERT INTO ledger_entries (
    student_id, transaction_id, entry_type, fee_type_name, amount,
    payment_mode, cashier_name, academic_term
  )
  SELECT
    entry.student_id,
    new_transaction.transaction_id,
    entry.entry_type,
    entry.fee_type_name,
    entry.amount,
    entry.payment_mode,
    entry.cashier_name,
    entry.academic_term
  FROM jsonb_to_recordset(COALESCE(p_ledger_entries, '[]'::jsonb)) AS entry(
    student_id text,
    entry_type text,
    fee_type_name text,
    amount numeric,
    payment_mode text,
    cashier_name text,
    academic_term text
  );

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(p_ledger_entries, '[]'::jsonb)) AS entry(
      student_id text
    )
    WHERE entry.student_id IS DISTINCT FROM COALESCE(
      NULLIF(p_transaction->>'student_id', ''),
      'applicant_' || NULLIF(p_transaction->>'applicant_id', '')
    )
  ) THEN
    RAISE EXCEPTION 'Ledger entries do not match the transaction owner';
  END IF;

  FOR ledger_update IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_ledger_updates, '[]'::jsonb))
  LOOP
    IF COALESCE((ledger_update->>'delete')::boolean, false) THEN
      DELETE FROM ledger_entries
      WHERE id = (ledger_update->>'id')::integer
        AND student_id = p_transaction->>'student_id';
    ELSE
      UPDATE ledger_entries
      SET amount = (ledger_update->>'amount')::numeric
      WHERE id = (ledger_update->>'id')::integer
        AND student_id = p_transaction->>'student_id';
    END IF;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN
      RAISE EXCEPTION 'Outstanding balance entry was not found for this student';
    END IF;
  END LOOP;

  IF p_applicant_payment IS NOT NULL THEN
    IF NULLIF(p_applicant_payment->>'id', '') IS NOT NULL THEN
      UPDATE applicant_payments
      SET amount_due = (p_applicant_payment->>'amount_due')::numeric,
          amount_paid = (p_applicant_payment->>'amount_paid')::numeric,
          updated_at = now()
      WHERE id = (p_applicant_payment->>'id')::integer
        AND applicant_id = (p_applicant_payment->>'applicant_id')::integer
        AND amount_paid = (p_applicant_payment->>'expected_amount_paid')::numeric;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Applicant payment record was not found';
      END IF;
    ELSE
      IF EXISTS (
        SELECT 1
        FROM applicant_payments
        WHERE applicant_id = (p_applicant_payment->>'applicant_id')::integer
          AND bundle_id = NULLIF(p_applicant_payment->>'bundle_id', '')::integer
      ) THEN
        RAISE EXCEPTION 'Applicant payment record changed during checkout. Refresh and retry.';
      END IF;
      INSERT INTO applicant_payments (
        applicant_id, bundle_id, amount_due, amount_paid
      ) VALUES (
        (p_applicant_payment->>'applicant_id')::integer,
        NULLIF(p_applicant_payment->>'bundle_id', '')::integer,
        (p_applicant_payment->>'amount_due')::numeric,
        (p_applicant_payment->>'amount_paid')::numeric
      );
    END IF;
  END IF;

  IF p_mark_applicant_eligible IS NOT NULL THEN
    UPDATE applicants
    SET status = 'eligible',
        eligible_at = now(),
        updated_at = now()
    WHERE id = p_mark_applicant_eligible
      AND id = NULLIF(p_transaction->>'applicant_id', '')::integer;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Applicant does not match the transaction';
    END IF;
  END IF;

  IF NULLIF(p_transaction->>'student_id', '') IS NOT NULL THEN
    SELECT
      COALESCE(academic_session, '2026/2027'),
      COALESCE(current_term, 'First Term')
      INTO active_session, active_term
    FROM school_settings
    WHERE id = 1;
    active_session := COALESCE(active_session, '2026/2027');
    active_term := COALESCE(active_term, 'First Term');

    DELETE FROM ledger_entries
    WHERE student_id = p_transaction->>'student_id'
      AND entry_type = 'debit'
      AND (
        fee_type_name LIKE 'Class Fee — %'
        OR fee_type_name LIKE 'Arrears B/F — %'
      );

    INSERT INTO ledger_entries (
      student_id, entry_type, fee_type_name, amount, academic_term
    )
    SELECT
      sf.student_id,
      'debit',
      CASE
        WHEN (
          (ft.academic_session IS NOT NULL AND ft.academic_session <> active_session)
          OR (ft.term IS NOT NULL AND ft.term <> active_term)
        )
        THEN 'Arrears B/F — ' || ft.name ||
          CASE
            WHEN NULLIF(concat_ws(' · ', ft.academic_session, ft.term), '') IS NOT NULL
            THEN ' (' || concat_ws(' · ', ft.academic_session, ft.term) || ')'
            ELSE ''
          END
        ELSE 'Class Fee — ' || ft.name || ' Remaining Balance'
      END,
      GREATEST(0, sf.amount_due - sf.amount_paid),
      ft.term
    FROM student_fees sf
    JOIN fee_types ft ON ft.id = sf.fee_type_id
    WHERE sf.student_id = p_transaction->>'student_id'
      AND GREATEST(0, sf.amount_due - sf.amount_paid) > 0;

    SELECT
      COALESCE(SUM(GREATEST(0, amount_due - amount_paid)), 0)
      INTO student_balance
    FROM student_fees
    WHERE student_id = p_transaction->>'student_id';

    student_balance := student_balance + COALESCE((
      SELECT SUM(amount)
      FROM ledger_entries
      WHERE student_id = p_transaction->>'student_id'
        AND entry_type = 'debit'
        AND (
          fee_type_name ILIKE '%Remaining Balance%'
          OR fee_type_name ILIKE '%Outstanding Balance Forward%'
        )
        AND fee_type_name NOT LIKE 'Class Fee — %'
    ), 0);

    UPDATE students
    SET current_fees_owed = student_balance,
        updated_at = now()
    WHERE student_id = p_transaction->>'student_id';
  END IF;

  RETURN jsonb_build_object(
    'transaction_id', new_transaction.transaction_id,
    'duplicate', false,
    'transaction', to_jsonb(new_transaction)
  );
END;
$$;

REVOKE ALL ON FUNCTION commit_cashier_checkout(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION commit_cashier_checkout(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer, text
) TO anon, authenticated;
