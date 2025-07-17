import Menu from "@/components/block/menu";
import { PATH, PATHS } from "@/lib/const";
import { useStorage } from "@/lib/utils";
import Chat from "@/page/Chat";
import Setting from "@/page/Setting";

function App() {
  const [path] = useStorage<string>(PATH, PATHS.CHAT, undefined, {
    temp: true,
  });
  return (
    <>
      <Menu />
      {path === PATHS.CHAT && <Chat />}
      {path === PATHS.SETTINGS && <Setting />}
    </>
  );
}

export default App;
