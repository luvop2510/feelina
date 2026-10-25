import { createContext, useContext } from "react";
import { emptyWorkspace, type Workspace } from "./types";
export type AppContextType = {
  data: Workspace;
  sample: boolean;
  reload: () => Promise<void>;
  notify: (message: string) => void;
  navigate: (route: string) => void;
  can: (roles: string[]) => boolean;
};
export const AppContext = createContext<AppContextType>({
  data: emptyWorkspace,
  sample: false,
  reload: async () => {},
  notify: () => {},
  navigate: () => {},
  can: () => false,
});
export const useApp = () => useContext(AppContext);
