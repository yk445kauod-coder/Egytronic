import { ViteReactSSG } from "vite-react-ssg";
import { routes } from "./routes";
import "./styles/tailwind.css";
import "./js/webmcp";

export const createRoot = ViteReactSSG({ routes });
