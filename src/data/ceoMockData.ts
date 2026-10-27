export const formatCurrency = (amount: number): string => {
  const rounded = Math.round(amount || 0);
  if (rounded < 0) {
    return `-Rs. ${Math.abs(rounded).toLocaleString('en-PK')}`;
  }
  return `Rs. ${rounded.toLocaleString('en-PK')}`;
};
