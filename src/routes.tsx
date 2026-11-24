import type { RouteRecord } from "vite-react-ssg";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import SoftwarePage from "./pages/Software";
import ContactPage from "./pages/Contact";
import HomeEn from "./en/pages/Home";
import PricingEn from "./en/pages/Pricing";
import SoftwareEn from "./en/pages/Software";
import ContactEn from "./en/pages/Contact";

export const routes: RouteRecord[] = [
  { path: "/", element: <Home locale="ar" /> },
  { path: "/pricing/", element: <Pricing locale="ar" /> },
  { path: "/software/", element: <SoftwarePage locale="ar" /> },
  { path: "/contact/", element: <ContactPage locale="ar" /> },
  { path: "/en/", element: <HomeEn locale="en" /> },
  { path: "/en/pricing/", element: <PricingEn locale="en" /> },
  { path: "/en/software/", element: <SoftwareEn locale="en" /> },
  { path: "/en/contact/", element: <ContactEn locale="en" /> },
];
