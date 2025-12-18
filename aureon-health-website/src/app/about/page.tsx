import { FaEye, FaBullseye, FaHeart } from 'react-icons/fa'

export default function About() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-aureon-amber to-aureon-ocean py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
            About Aureon Health
          </h1>
          <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto drop-shadow">
            Pioneering the future of healthcare through innovation, dedication, and excellence
          </p>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold mb-8 text-gradient-aureon">Our Story</h2>
            <div className="space-y-6 text-lg text-gray-700 leading-relaxed">
              <p>
                Aureon Health was founded with a singular vision: to transform the healthcare
                landscape through innovative technology and compassionate care. We recognized
                that healthcare providers needed better tools to deliver exceptional patient
                care while managing the complexities of modern medical practice.
              </p>
              <p>
                Our journey began when a team of healthcare professionals, technologists, and
                visionaries came together to address the challenges they witnessed firsthand.
                We saw the gap between the potential of healthcare technology and the reality
                of daily clinical practice, and we knew we could do better.
              </p>
              <p>
                Today, Aureon Health stands at the forefront of healthcare innovation,
                providing comprehensive solutions that empower healthcare providers, improve
                patient outcomes, and streamline operations. Our commitment to excellence and
                innovation drives everything we do.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission, Vision, Values */}
      <section className="py-20 bg-gradient-aureon-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Vision */}
            <div className="text-center">
              <div className="inline-block p-6 bg-gradient-to-br from-aureon-amber to-aureon-gold rounded-full mb-6">
                <FaEye className="text-white text-5xl" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-aureon-ocean">Our Vision</h3>
              <p className="text-gray-700 text-lg">
                To be the leading healthcare technology partner, revolutionizing how care is
                delivered and experienced worldwide, making quality healthcare accessible to
                all.
              </p>
            </div>

            {/* Mission */}
            <div className="text-center">
              <div className="inline-block p-6 bg-gradient-to-br from-aureon-gold to-aureon-ocean rounded-full mb-6">
                <FaBullseye className="text-white text-5xl" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-aureon-ocean">Our Mission</h3>
              <p className="text-gray-700 text-lg">
                To empower healthcare providers with innovative, intuitive solutions that
                enhance patient care, improve outcomes, and simplify the complexities of
                modern healthcare delivery.
              </p>
            </div>

            {/* Values */}
            <div className="text-center">
              <div className="inline-block p-6 bg-gradient-to-br from-aureon-ocean to-aureon-blue rounded-full mb-6">
                <FaHeart className="text-white text-5xl" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-aureon-ocean">Our Values</h3>
              <p className="text-gray-700 text-lg">
                Innovation, integrity, compassion, and excellence guide every decision we
                make. We believe in putting patients first and supporting providers with the
                best tools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-12 text-gradient-aureon">
            Why Healthcare Providers Choose Us
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-2 h-2 mt-2 bg-aureon-amber rounded-full"></div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-aureon-ocean">
                  Proven Track Record
                </h3>
                <p className="text-gray-700">
                  Years of experience delivering results that matter for healthcare
                  organizations of all sizes.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-2 h-2 mt-2 bg-aureon-gold rounded-full"></div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-aureon-ocean">
                  Cutting-Edge Technology
                </h3>
                <p className="text-gray-700">
                  Leveraging the latest innovations to provide state-of-the-art healthcare
                  solutions.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-2 h-2 mt-2 bg-aureon-ocean rounded-full"></div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-aureon-ocean">
                  Dedicated Support
                </h3>
                <p className="text-gray-700">
                  Our team is committed to your success with 24/7 support and personalized
                  assistance.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-2 h-2 mt-2 bg-aureon-blue rounded-full"></div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-aureon-ocean">
                  Continuous Innovation
                </h3>
                <p className="text-gray-700">
                  We never stop improving, constantly evolving our solutions to meet changing
                  needs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-aureon-ocean to-aureon-blue py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Learn More?
          </h2>
          <p className="text-xl text-gray-200 mb-8">
            Discover how Aureon Health can transform your healthcare delivery
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/product"
              className="bg-aureon-amber text-white px-8 py-3 rounded-full font-semibold hover:bg-white hover:text-aureon-ocean transition-all duration-300"
            >
              Explore Our Product
            </a>
            <a
              href="/contact"
              className="bg-transparent text-white border-2 border-white px-8 py-3 rounded-full font-semibold hover:bg-white hover:text-aureon-ocean transition-all duration-300"
            >
              Contact Us
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
