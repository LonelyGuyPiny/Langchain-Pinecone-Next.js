import { PageSettings } from "@/types/settings";

export const saveSettings = (settings: PageSettings) => {
  localStorage.setItem('settings', JSON.stringify(settings));
};

export const saveAvatar = (avatar: string) => {
  localStorage.setItem('avatar', avatar);
};