import { Link } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, Users } from 'lucide-react';
import { CAREERS_CONFIG } from '../config/brandContact';

const UPCOMING_ROLES = [
  'Part-time Crew Member',
  'Outlet Worker',
  'Outlet Manager',
  'Kitchen Team Member',
];

export function CareersScreen() {
  return (
    <section className="relative min-h-[72vh] overflow-hidden bg-[linear-gradient(180deg,#f6f7f3_0%,#eef4eb_45%,#f7f7f4_100%)] pt-32 pb-20">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-4xl rounded-[30px] border border-primary/12 bg-white/88 p-7 shadow-[0_16px_46px_rgba(17,34,10,0.12)] md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">CULTIV Careers</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">Build with us as we scale.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-foreground/70">
            We regularly hire for part-time workers, outlet workers, and outlet managers.
            We are not hiring actively right now, but this page is live and ready for upcoming openings.
          </p>

          <div className="mt-7 grid gap-3 md:grid-cols-2">
            {UPCOMING_ROLES.map((role) => (
              <div key={role} className="rounded-2xl border border-primary/12 bg-[#f8fbf7] px-4 py-3">
                <p className="text-sm font-medium text-foreground/88">{role}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 rounded-2xl border border-primary/12 bg-white/80 p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold text-foreground/88">Want to be considered early?</p>
              <p className="mt-1 text-sm text-foreground/65">
                Send your profile to 
                <a className="ml-1 font-medium text-primary hover:underline" href={`mailto:${CAREERS_CONFIG.jobsEmail}`}>
                  {CAREERS_CONFIG.jobsEmail}
                </a>
                .
              </p>
            </div>
            <a
              href={`mailto:${CAREERS_CONFIG.jobsEmail}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <BriefcaseBusiness className="h-4 w-4" />
              Share Resume
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-primary/18 bg-white px-4 py-2 text-sm font-medium text-foreground/78">
              <Users className="h-4 w-4 text-primary" />
              Back to Home
            </Link>
            <Link to="/order" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Order Now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
