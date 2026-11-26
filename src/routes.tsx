import type { RouteRecord } from "vite-react-ssg";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import SoftwarePage from "./pages/Software";
import ContactPage from "./pages/Contact";
import AnswersPage from "./pages/Answers";
import Work from "./pages/Work";
import Legal from "./pages/Legal";
import Blog from "./pages/Blog";
import PostPage from "./pages/Post";
import { POSTS } from "./data/posts";
import HomeEn from "./en/pages/Home";
import PricingEn from "./en/pages/Pricing";
import SoftwareEn from "./en/pages/Software";
import ContactEn from "./en/pages/Contact";
import AnswersEn from "./en/pages/Answers";
import WorkEn from "./en/pages/Work";
import LegalEn from "./en/pages/Legal";

const postRoutes = POSTS.flatMap((post) => [
  { path: `/blog/${post.slug}/`, element: <PostPage locale="ar" post={post} /> },
  { path: `/en/blog/${post.slug}/`, element: <PostPage locale="en" post={post} /> },
]);

export const routes: RouteRecord[] = [
  { path: "/", element: <Home locale="ar" /> },
  { path: "/pricing/", element: <Pricing locale="ar" /> },
  { path: "/software/", element: <SoftwarePage locale="ar" /> },
  { path: "/contact/", element: <ContactPage locale="ar" /> },
  { path: "/answers/", element: <AnswersPage locale="ar" /> },
  { path: "/work/", element: <Work locale="ar" /> },
  { path: "/privacy/", element: <Legal locale="ar" kind="privacy" /> },
  { path: "/terms/", element: <Legal locale="ar" kind="terms" /> },
  { path: "/blog/", element: <Blog locale="ar" /> },
  { path: "/en/", element: <HomeEn locale="en" /> },
  { path: "/en/pricing/", element: <PricingEn locale="en" /> },
  { path: "/en/software/", element: <SoftwareEn locale="en" /> },
  { path: "/en/contact/", element: <ContactEn locale="en" /> },
  { path: "/en/answers/", element: <AnswersEn /> },
  { path: "/en/work/", element: <WorkEn /> },
  { path: "/en/privacy/", element: <LegalEn kind="privacy" /> },
  { path: "/en/terms/", element: <LegalEn kind="terms" /> },
  { path: "/en/blog/", element: <Blog locale="en" /> },
  ...postRoutes,
];
