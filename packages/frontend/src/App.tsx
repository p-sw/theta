import Menu from "@/components/block/menu";
import { PATHS } from "@/lib/const";
import { usePath } from "@/lib/storage-hooks";
import Chat from "@/page/Chat";
import Setting from "@/page/Setting";

function App() {
  const [path] = usePath();
  return (
    <>
      <Menu />
      {path === PATHS.CHAT && <Chat />}
      {path === PATHS.SETTINGS && <Setting />}
    </>
  );
}

export default App;
