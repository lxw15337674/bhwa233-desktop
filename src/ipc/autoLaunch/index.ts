import { setAutoLaunchHandler, getAutoLaunchStatusHandler } from "./handlers";

export const autoLaunch = {
  setAutoLaunch: setAutoLaunchHandler,
  getStatus: getAutoLaunchStatusHandler,
};
