const isEmpty = (value: any) => {
    const isValEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "object" && Object.keys(value).length === 0 && value === null) ||
      (typeof value === "string" && value.trim().length === 0);
  
    return isValEmpty;
  };
  
export default isEmpty;