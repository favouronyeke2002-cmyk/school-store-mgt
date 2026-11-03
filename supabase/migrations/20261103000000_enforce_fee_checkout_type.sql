ALTER FUNCTION public.commit_cashier_checkout(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer, text
) RENAME TO commit_cashier_checkout_impl;

REVOKE ALL ON FUNCTION public.commit_cashier_checkout_impl(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer, text
) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.commit_cashier_checkout(
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
BEGIN
  IF p_request->>'kind' IN ('FEE_PAYMENT', 'BUNDLE_BALANCE_PAYMENT') THEN
    p_transaction := p_transaction ||
      jsonb_build_object('type', 'FEES_CASH_COLLECTION');
  END IF;

  RETURN public.commit_cashier_checkout_impl(
    p_client_transaction_id,
    p_request,
    p_transaction,
    p_items,
    p_issuances,
    p_stock_changes,
    p_ledger_entries,
    p_fee_update,
    p_applicant_payment,
    p_ledger_updates,
    p_mark_applicant_eligible,
    p_performed_by
  );
END;
$$;

REVOKE ALL ON FUNCTION public.commit_cashier_checkout(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_cashier_checkout(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, integer, text
) TO anon, authenticated;
