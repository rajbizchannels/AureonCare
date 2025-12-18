import {
  FaUserMd,
  FaCalendarAlt,
  FaChartLine,
  FaPrescriptionBottleAlt,
  FaFileMedical,
  FaShieldAlt,
  FaMobileAlt,
  FaCloud,
} from 'react-icons/fa'

export default function Product() {
  const features = [
    {
      icon: <FaUserMd className="text-5xl" />,
      title: 'Patient Management',
      description:
        'Comprehensive patient records, history tracking, and streamlined workflows to enhance patient care and reduce administrative burden.',
    },
    {
      icon: <FaCalendarAlt className="text-5xl" />,
      title: 'Smart Scheduling',
      description:
        'Intelligent appointment scheduling with automated reminders, waitlist management, and calendar synchronization.',
    },
    {
      icon: <FaPrescriptionBottleAlt className="text-5xl" />,
      title: 'E-Prescribing',
      description:
        'Secure electronic prescribing with drug interaction checking, formulary integration, and direct pharmacy communication.',
    },
    {
      icon: <FaFileMedical className="text-5xl" />,
      title: 'Electronic Health Records',
      description:
        'Complete EHR solution with customizable templates, clinical decision support, and seamless documentation.',
    },
    {
      icon: <FaChartLine className="text-5xl" />,
      title: 'Analytics & Reporting',
      description:
        'Real-time insights and comprehensive reports to track performance, outcomes, and operational efficiency.',
    },
    {
      icon: <FaShieldAlt className="text-5xl" />,
      title: 'HIPAA Compliance',
      description:
        'Enterprise-grade security with full HIPAA compliance, encrypted data storage, and role-based access control.',
    },
    {
      icon: <FaMobileAlt className="text-5xl" />,
      title: 'Mobile Access',
      description:
        'Access your practice anywhere with our responsive mobile app, enabling care delivery on the go.',
    },
    {
      icon: <FaCloud className="text-5xl" />,
      title: 'Cloud-Based',
      description:
        'Reliable cloud infrastructure with automatic backups, updates, and 99.9% uptime guarantee.',
    },
  ]

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-aureon-amber via-aureon-gold to-aureon-ocean py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
            Aureon Health Platform
          </h1>
          <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto drop-shadow mb-8">
            A comprehensive healthcare management solution designed to streamline operations,
            enhance patient care, and drive better outcomes
          </p>
          <a
            href="/contact"
            className="inline-block bg-white text-aureon-blue px-10 py-4 rounded-full font-semibold text-lg hover:bg-aureon-ocean hover:text-white transition-all duration-300 shadow-lg"
          >
            Request a Demo
          </a>
        </div>
      </section>

      {/* Product Overview */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-4xl font-bold mb-6 text-gradient-aureon">
              Transform Your Healthcare Practice
            </h2>
            <p className="text-xl text-gray-700 leading-relaxed">
              Aureon Health provides an all-in-one platform that integrates seamlessly into
              your workflow, helping you focus on what matters most: delivering exceptional
              patient care. Our solution combines powerful features with an intuitive
              interface, making advanced healthcare technology accessible to practices of all
              sizes.
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-gradient-aureon-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-4 text-gradient-aureon">
            Powerful Features
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16 max-w-3xl mx-auto">
            Everything you need to run a modern, efficient healthcare practice
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="text-aureon-ocean mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-3 text-aureon-ocean">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-16 text-gradient-aureon">
            Why Healthcare Providers Love Aureon Health
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="text-5xl font-bold text-aureon-amber mb-4">50%</div>
              <h3 className="text-2xl font-semibold mb-3 text-aureon-ocean">
                Time Savings
              </h3>
              <p className="text-gray-700">
                Reduce administrative time with automated workflows and intelligent scheduling
              </p>
            </div>

            <div className="text-center">
              <div className="text-5xl font-bold text-aureon-gold mb-4">95%</div>
              <h3 className="text-2xl font-semibold mb-3 text-aureon-ocean">
                User Satisfaction
              </h3>
              <p className="text-gray-700">
                Healthcare providers rate our platform highly for ease of use and reliability
              </p>
            </div>

            <div className="text-center">
              <div className="text-5xl font-bold text-aureon-ocean mb-4">30%</div>
              <h3 className="text-2xl font-semibold mb-3 text-aureon-ocean">
                Revenue Growth
              </h3>
              <p className="text-gray-700">
                Improve billing efficiency and patient throughput to grow your practice
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Integration Section */}
      <section className="py-20 bg-gradient-aureon-light">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6 text-gradient-aureon">
            Seamless Integration
          </h2>
          <p className="text-xl text-gray-700 mb-8">
            Aureon Health integrates with the tools you already use, including major EHR
            systems, laboratory information systems, pharmacy networks, and billing platforms.
            Our open API ensures that your data flows seamlessly across your entire healthcare
            ecosystem.
          </p>
          <div className="flex flex-wrap justify-center gap-6 mt-12">
            <div className="bg-white px-8 py-4 rounded-lg shadow">HL7 Compatible</div>
            <div className="bg-white px-8 py-4 rounded-lg shadow">FHIR Integration</div>
            <div className="bg-white px-8 py-4 rounded-lg shadow">RESTful API</div>
            <div className="bg-white px-8 py-4 rounded-lg shadow">Lab Interfaces</div>
            <div className="bg-white px-8 py-4 rounded-lg shadow">Pharmacy Networks</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-aureon-ocean to-aureon-blue py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Practice?
          </h2>
          <p className="text-xl text-gray-200 mb-8">
            Schedule a personalized demo and see how Aureon Health can revolutionize your
            healthcare delivery
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/contact"
              className="bg-aureon-amber text-white px-10 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-aureon-ocean transition-all duration-300 shadow-lg"
            >
              Request a Demo
            </a>
            <a
              href="/contact"
              className="bg-transparent text-white border-2 border-white px-10 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-aureon-ocean transition-all duration-300"
            >
              Contact Sales
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
