export function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function completionTerms(input, {today = localToday(), legacy = false} = {}) {
  const deal = {...input};
  let automatic = deal.paymentDueDateSource === 'automatic' || !deal.paymentDueDate;
  if (deal.stage === 'Completed') {
    if (!deal.completedDate) {
      deal.completedDate = today;
      deal.completedDateEstimated = legacy;
    }
  } else {
    deal.completedDate = '';
    deal.completedDateEstimated = false;
  }
  if (deal.compensationType !== 'Paid') {
    deal.paymentDueDate = '';
    deal.paymentDueDateSource = '';
  } else if (automatic) {
    deal.paymentDueDateSource = 'automatic';
    deal.paymentDueDate = '';
    if (deal.completedDate) {
      const date = new Date(deal.completedDate + 'T12:00:00Z');
      date.setUTCDate(date.getUTCDate()+30);
      deal.paymentDueDate = date.toISOString().slice(0,10);
    }
  } else {
    deal.paymentDueDateSource = 'manual';
  }
  return deal;
}
