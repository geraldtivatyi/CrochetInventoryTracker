import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-neutral-200 py-4 mt-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="mb-4 sm:mb-0">
            <p className="text-sm text-neutral-600">© {new Date().getFullYear()} CrochetTrack. All rights reserved.</p>
          </div>
          <div className="flex space-x-4">
            <Link href="#">
              <a className="text-neutral-600 hover:text-primary-500 text-sm">Help</a>
            </Link>
            <Link href="#">
              <a className="text-neutral-600 hover:text-primary-500 text-sm">Privacy</a>
            </Link>
            <Link href="#">
              <a className="text-neutral-600 hover:text-primary-500 text-sm">Terms</a>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
