export const saveNameSpace = (name: string) => {
  localStorage.setItem('namespace', JSON.stringify(name));
};
