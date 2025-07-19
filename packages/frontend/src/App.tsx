import Menu from "@/components/block/menu";
import { PATHS } from "@/lib/const";
import { usePath } from "@/lib/storage-hooks";
import Chat from "@/page/Chat";
import Setting from "@/page/Setting";
import { Toaster } from "sonner";

function App() {
  const [path] = usePath();
  return (
    <>
      <Toaster />
      <Menu />
      {path === PATHS.CHAT && <Chat />}
      {path === PATHS.SETTINGS && <Setting />}
    </>
  );
}

export default App;
