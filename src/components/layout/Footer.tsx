import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border/60 bg-surface/50">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-10 py-5">
        
        <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            <Link to="/" className="text-xl font-bold tracking-tight mb-0.5">
              MOVIES<span className="text-primary">ALERT</span>
            </Link>
            <div className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
              © {new Date().getFullYear()} MOVIESALERT. All rights reserved.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-5 text-sm font-medium text-muted-foreground">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <Link to="/about" className="hover:text-white transition-colors">About Us</Link>
            <Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link>
            <Link to="/dmca" className="hover:text-white transition-colors">DMCA</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground/40 leading-relaxed text-center md:text-left max-w-5xl">
            MOVIESALERT does not host any files, it merely pulls streams from 3rd party services. Legal issues should be taken up with the file hosts and providers. MOVIESALERT is not responsible for any media files shown by the video providers.
          </p>
        </div>

      </div>
    </footer>
  );
}
