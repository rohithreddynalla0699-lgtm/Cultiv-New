// Footer — site footer with navigation links, social links, and legal copy.

import { Logo } from "./Logo";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="py-16 border-t border-border bg-gradient-to-b from-background to-[#F5F5F0]">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <Logo variant="wordmark" size="md" className="mb-4" />
            <p className="text-foreground/70 max-w-sm leading-relaxed mb-6">
              Cultivating better daily habits through clean, protein-forward meals 
              and intentional wellness.
            </p>
            <div className="text-sm text-foreground/60">
              © 2026 CULTIV. All rights reserved.
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-4">Navigation</h4>
            <ul className="space-y-3 text-foreground/70 text-sm">
              <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
              <li><Link to="/menu" className="hover:text-foreground transition-colors">Menu</Link></li>
              <li><Link to="/orders" className="hover:text-foreground transition-colors">Orders</Link></li>
              <li><Link to="/rewards" className="hover:text-foreground transition-colors">Rewards</Link></li>
              <li><Link to="/profile" className="hover:text-foreground transition-colors">Profile</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-4">Connect</h4>
            <ul className="space-y-3 text-foreground/70 text-sm">
              <li><a href="#" className="hover:text-foreground transition-colors">Instagram</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-foreground/60">
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
          </div>
          <div>
            Made with intention
          </div>
        </div>
      </div>
    </footer>
  );
}