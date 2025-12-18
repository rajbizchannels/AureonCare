import Link from 'next/link'
import { FaHeartbeat, FaUsers, FaLightbulb, FaAward } from 'react-icons/fa'

export default function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-aureon-amber via-aureon-gold to-aureon-ocean min-h-[600px] flex items-center">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 drop-shadow-lg">
            Welcome to Aureon Health
          </h1>
          <p className="text-xl md:text-2xl text-white mb-8 max-w-3xl mx-auto drop-shadow">
            Transforming Healthcare Through Innovation and Excellence
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/product"
              className="bg-white text-aureon-blue px-8 py-4 rounded-full font-semibold text-lg hover:bg-aureon-amber hover:text-white transition-all duration-300 shadow-lg"
            >
              Explore Our Product
            </Link>
            <Link
              href="/contact"
              className="bg-aureon-ocean text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-aureon-ocean transition-all duration-300 shadow-lg border-2 border-white"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 text-gradient-aureon">
            Why Choose Aureon Health?
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16 max-w-3xl mx-auto">
            We combine cutting-edge technology with compassionate care to deliver
            exceptional healthcare solutions
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="text-center p-6 rounded-lg hover:shadow-xl transition-shadow bg-gradient-aureon-light">
              <div className="inline-block p-4 bg-gradient-to-br from-aureon-amber to-aureon-gold rounded-full mb-4">
                <FaHeartbeat className="text-white text-4xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-aureon-ocean">
                Patient-Centered Care
              </h3>
              <p className="text-gray-600">
                Prioritizing patient needs and outcomes in every decision we make
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center p-6 rounded-lg hover:shadow-xl transition-shadow bg-gradient-aureon-light">
              <div className="inline-block p-4 bg-gradient-to-br from-aureon-gold to-aureon-ocean rounded-full mb-4">
                <FaLightbulb className="text-white text-4xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-aureon-ocean">
                Innovation First
              </h3>
              <p className="text-gray-600">
                Leveraging the latest technology to revolutionize healthcare delivery
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center p-6 rounded-lg hover:shadow-xl transition-shadow bg-gradient-aureon-light">
              <div className="inline-block p-4 bg-gradient-to-br from-aureon-amber to-aureon-ocean rounded-full mb-4">
                <FaUsers className="text-white text-4xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-aureon-ocean">
                Expert Team
              </h3>
              <p className="text-gray-600">
                Experienced professionals dedicated to healthcare excellence
              </p>
            </div>

            {/* Feature 4 */}
            <div className="text-center p-6 rounded-lg hover:shadow-xl transition-shadow bg-gradient-aureon-light">
              <div className="inline-block p-4 bg-gradient-to-br from-aureon-gold to-aureon-blue rounded-full mb-4">
                <FaAward className="text-white text-4xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-aureon-ocean">
                Proven Results
              </h3>
              <p className="text-gray-600">
                Track record of improving patient outcomes and satisfaction
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-aureon-ocean to-aureon-blue py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Healthcare?
          </h2>
          <p className="text-xl text-gray-200 mb-8">
            Join us in our mission to deliver exceptional healthcare solutions
          </p>
          <Link
            href="/contact"
            className="inline-block bg-aureon-amber text-white px-10 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-aureon-ocean transition-all duration-300 shadow-lg"
          >
            Contact Us Today
          </Link>
        </div>
      </section>
    </div>
  )
}
