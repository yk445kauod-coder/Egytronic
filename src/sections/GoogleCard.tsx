import { useLocale } from "../i18n/useLocale";

const PROFILE = "https://g.page/r/CZxZjGcYazbKEBM";
const REVIEW = `${PROFILE}/review`;

export default function GoogleCard() {
  const en = useLocale() === "en";

  return (
    <section className="section section--alt gcard" id="google">
      <div className="wrap gcard__inner">
        <div className="gcard__copy">
          <span className="px-tag">{en ? "Google" : "جوجل"}</span>
          <h2>{en ? "Rate us on Google" : "قيّمنا على جوجل"}</h2>
          <p>
            {en
              ? "Egytronic is listed on Google Maps as a software company. A review takes 30 seconds and it is what a new client sees first when they search for us."
              : "بروفايل Egytronic موجود على خرائط جوجل كـ Software company. التقييم بياخد 30 ثانية، وهو أول حاجة بتظهر لحد بيدوّر علينا."}
          </p>
          <p className="gcard__note">
            {en
              ? "No reviews are published yet — the first one will appear here and on Google."
              : "لسه مفيش تقييمات منشورة — أول تقييم هيظهر هنا وعلى جوجل."}
          </p>
        </div>
        <div className="gcard__actions">
          <a className="px-btn" href={REVIEW} target="_blank" rel="noopener noreferrer">
            {en ? "Write a review ↗" : "اكتب تقييم ↗"}
          </a>
          <a className="px-btn px-btn--ghost" href={PROFILE} target="_blank" rel="noopener noreferrer">
            {en ? "Open the profile ↗" : "شوف البروفايل ↗"}
          </a>
        </div>
      </div>
    </section>
  );
}
