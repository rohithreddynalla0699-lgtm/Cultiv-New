// Location — store location, hours, and contact info section.

import { MapPin, Clock, Phone } from "lucide-react";

export function Location() {
  return (
    <section className="py-32 relative overflow-hidden bg-gradient-to-b from-[#F5F5F0] to-background">
      {/* Grain texture */}
      <div 
        className="absolute inset-0 opacity-[0.04]" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px'
        }}
      />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl mb-6 tracking-tight font-semibold">
              Visit us in Siddipet
            </h2>
            <p className="text-xl text-foreground/60">
              Telangana, India
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-card/80 backdrop-blur-sm p-8 rounded-2xl border border-border text-center shadow-lg hover:shadow-xl transition-all">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <MapPin className="w-7 h-7 text-primary" strokeWidth={2} />
              </div>
              <h3 className="text-lg font-semibold mb-3">Location</h3>
              <p className="text-foreground/70 text-sm leading-relaxed">
                Siddipet<br />
                Telangana, India
              </p>
            </div>

            <div className="bg-card/80 backdrop-blur-sm p-8 rounded-2xl border border-border text-center shadow-lg hover:shadow-xl transition-all">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Clock className="w-7 h-7 text-primary" strokeWidth={2} />
              </div>
              <h3 className="text-lg font-semibold mb-3">Hours</h3>
              <p className="text-foreground/70 text-sm leading-relaxed">
                Mon – Sat: 11:00 AM – 9:00 PM<br />
                Sunday: 12:00 PM – 8:00 PM
              </p>
            </div>

            <div className="bg-card/80 backdrop-blur-sm p-8 rounded-2xl border border-border text-center shadow-lg hover:shadow-xl transition-all">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Phone className="w-7 h-7 text-primary" strokeWidth={2} />
              </div>
              <h3 className="text-lg font-semibold mb-3">Contact</h3>
              <p className="text-foreground/70 text-sm leading-relaxed">
                +91 XXXXX XXXXX<br />
                hello@cultiv.in
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
