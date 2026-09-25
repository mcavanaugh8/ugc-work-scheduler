export function paymentStatus(deal, today) {
  if (deal.compensationType !== 'Paid' || Number(deal.amount) <= 0) return {label: 'Not applicable', daysLate: 0, overdue: false};
  if (deal.paidDate) return {label: 'Paid', daysLate: 0, overdue: false};
  if (deal.stage === 'In Discussion') return {label: 'Not agreed', daysLate: 0, overdue: false};
  if (!deal.paymentDueDate) return {label: deal.stage === 'Completed' ? 'Due date not set' : 'Due 30 days after completion', daysLate: 0, overdue: false};
  if (deal.paymentDueDate < today) {
    const daysLate = Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(deal.paymentDueDate + 'T00:00:00Z')) / 86400000);
    return {label: 'Overdue', daysLate, overdue: true};
  }
  return {label: deal.paymentDueDate === today ? 'Due today' : 'Upcoming', daysLate: 0, overdue: false};
}
