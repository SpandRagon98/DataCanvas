export const validateHierarchy = (levels) => {
  if (!levels || levels.length < 2) {
    return {
      valid: false,
      message: "Hierarchy must contain at least 2 levels.",
    };
  }

  const unique = new Set(levels);
  if (unique.size !== levels.length) {
    return {
      valid: false,
      message: "Hierarchy levels must be unique.",
    };
  }

  return {
    valid: true,
    message: "",
  };
};
