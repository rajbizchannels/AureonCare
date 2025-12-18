import Link from 'next/link'
import { FaFacebook, FaTwitter, FaLinkedin, FaInstagram } from 'react-icons/fa'

export default function Footer() {
  return (
    <footer className="bg-gradient-to-r from-aureon-ocean to-aureon-blue text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-bold mb-4 text-aureon-amber">Aureon Health</h3>
            <p className="text-gray-200 mb-4">
              Transforming healthcare delivery with innovative solutions that empower
              providers and improve patient outcomes.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="hover:text-aureon-amber transition-colors">
                <FaFacebook size={24} />
              </a>
              <a href="#" className="hover:text-aureon-amber transition-colors">
                <FaTwitter size={24} />
              </a>
              <a href="#" className="hover:text-aureon-amber transition-colors">
                <FaLinkedin size={24} />
              </a>
              <a href="#" className="hover:text-aureon-amber transition-colors">
                <FaInstagram size={24} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-aureon-amber">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="hover:text-aureon-amber transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/product" className="hover:text-aureon-amber transition-colors">
                  Our Product
                </Link>
              </li>
              <li>
                <Link href="/team" className="hover:text-aureon-amber transition-colors">
                  Team
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-aureon-amber transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-aureon-amber">Contact</h4>
            <ul className="space-y-2 text-gray-200">
              <li>Email: info@aureonhealth.com</li>
              <li>Phone: (555) 123-4567</li>
              <li>Address: 123 Healthcare Blvd</li>
              <li>Suite 100, City, ST 12345</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-500 mt-8 pt-8 text-center text-gray-300">
          <p>&copy; {new Date().getFullYear()} Aureon Health. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
