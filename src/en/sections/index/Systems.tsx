export default function Systems() {
  return (
    <>
      <section className="section section--systems" id="systems" aria-labelledby="systems-title">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="px-tag">Business systems</span>
        <h2 id="systems-title">Get your whole business running on one system</h2>
        <p>We pick the right system for your line of work with you, install it, and tailor it to how you operate: permissions, reports, invoices and the words your team already uses — with training until they run it with confidence.</p>
      </div>

      <ul className="systems reveal">
        <li className="system">
          <img className="system__art" src="/assets/img/pixel/g-erp.svg" alt="" width="56" height="56" loading="lazy" decoding="async" />
          <span className="system__k">ERP</span>
          <h3>Resource planning</h3>
          <p>Stock, invoices, purchasing and accounts in one system.</p>
        </li>
        <li className="system">
          <img className="system__art" src="/assets/img/pixel/g-crm.svg" alt="" width="56" height="56" loading="lazy" decoding="async" />
          <span className="system__k">CRM</span>
          <h3>Customer relations</h3>
          <p>Customers, follow-ups, deals and sales reports.</p>
        </li>
        <li className="system">
          <img className="system__art" src="/assets/img/pixel/g-pos.svg" alt="" width="56" height="56" loading="lazy" decoding="async" />
          <span className="system__k">POS</span>
          <h3>Point of sale</h3>
          <p>Checkout, shifts and stock per branch.</p>
        </li>
        <li className="system">
          <img className="system__art" src="/assets/img/pixel/g-hotel.svg" alt="" width="56" height="56" loading="lazy" decoding="async" />
          <span className="system__k">HMS</span>
          <h3>Hotel management</h3>
          <p>Bookings, rooms, stays, folios and guest billing.</p>
        </li>
        <li className="system">
          <img className="system__art" src="/assets/img/pixel/g-lms.svg" alt="" width="56" height="56" loading="lazy" decoding="async" />
          <span className="system__k">LMS</span>
          <h3>Learning platform</h3>
          <p>Courses, lessons, quizzes and certificates.</p>
        </li>
        <li className="system">
          <img className="system__art" src="/assets/img/pixel/g-hms.svg" alt="" width="56" height="56" loading="lazy" decoding="async" />
          <span className="system__k">CLINIC</span>
          <h3>Clinic management</h3>
          <p>Appointments, patient records, invoices and prescriptions.</p>
        </li>
      </ul>

      <ul className="systems__how reveal">
        <li><b>Install</b> Existing data and users</li>
        <li><b>Adapt</b> Permissions, invoices, reports and wording</li>
        <li><b>Train</b> Your team, plus a runbook</li>
      </ul>

      <p className="systems__note reveal">Not seeing what you need? <a href="/contact/">Ask for a custom system</a> and we will scope it with you.</p>
    </div>
  </section>
    </>
  );
}
