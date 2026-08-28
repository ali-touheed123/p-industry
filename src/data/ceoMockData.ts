export const formatCurrency = (amount: number): string => {
  return `Rs. ${Math.round(amount || 0).toLocaleString('en-PK')}`;
};
