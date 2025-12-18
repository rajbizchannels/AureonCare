'use client'

import { useState } from 'react'
import {
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaClock,
  FaLinkedin,
  FaTwitter,
  FaFacebook,
} from 'react-icons/fa'

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    subject: '',
    message: '',
  })

  const [submitted, setSubmitted] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real application, you would send this data to your backend
    console.log('Form submitted:', formData)
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 5000)
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-aureon-amber via-aureon-gold to-aureon-ocean py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
            Get in Touch
          </h1>
          <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto drop-shadow">
            We&apos;re here to help. Reach out to learn more about Aureon Health or schedule
            a demo
          </p>
        </div>
      </section>

      {/* Contact Information & Form */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Information */}
            <div>
              <h2 className="text-4xl font-bold mb-8 text-gradient-aureon">
                Contact Information
              </h2>
              <p className="text-lg text-gray-700 mb-8">
                Have questions? We&apos;d love to hear from you. Send us a message and
                we&apos;ll respond as soon as possible.
              </p>

              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-aureon-amber to-aureon-gold rounded-full flex items-center justify-center">
                    <FaPhone className="text-white text-xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-aureon-ocean mb-1">Phone</h3>
                    <p className="text-gray-600">+1 (555) 123-4567</p>
                    <p className="text-gray-600">Toll-free: 1-800-AUREON-1</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-aureon-gold to-aureon-ocean rounded-full flex items-center justify-center">
                    <FaEnvelope className="text-white text-xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-aureon-ocean mb-1">Email</h3>
                    <p className="text-gray-600">info@aureonhealth.com</p>
                    <p className="text-gray-600">support@aureonhealth.com</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-aureon-ocean to-aureon-blue rounded-full flex items-center justify-center">
                    <FaMapMarkerAlt className="text-white text-xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-aureon-ocean mb-1">Address</h3>
                    <p className="text-gray-600">123 Healthcare Boulevard</p>
                    <p className="text-gray-600">Suite 100</p>
                    <p className="text-gray-600">San Francisco, CA 94105</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-aureon-amber to-aureon-ocean rounded-full flex items-center justify-center">
                    <FaClock className="text-white text-xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-aureon-ocean mb-1">
                      Business Hours
                    </h3>
                    <p className="text-gray-600">Monday - Friday: 9:00 AM - 6:00 PM PST</p>
                    <p className="text-gray-600">Saturday - Sunday: Closed</p>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-aureon-ocean mb-4">Follow Us</h3>
                <div className="flex space-x-4">
                  <a
                    href="#"
                    className="w-10 h-10 bg-gradient-to-br from-aureon-amber to-aureon-gold rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                  >
                    <FaLinkedin className="text-white text-xl" />
                  </a>
                  <a
                    href="#"
                    className="w-10 h-10 bg-gradient-to-br from-aureon-gold to-aureon-ocean rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                  >
                    <FaTwitter className="text-white text-xl" />
                  </a>
                  <a
                    href="#"
                    className="w-10 h-10 bg-gradient-to-br from-aureon-ocean to-aureon-blue rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                  >
                    <FaFacebook className="text-white text-xl" />
                  </a>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-gradient-aureon-light p-8 rounded-lg">
              <h2 className="text-3xl font-bold mb-6 text-gradient-aureon">Send a Message</h2>

              {submitted && (
                <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
                  Thank you! Your message has been sent successfully. We&apos;ll get back to
                  you soon.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-semibold text-aureon-ocean mb-2"
                  >
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aureon-gold focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-aureon-ocean mb-2"
                  >
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aureon-gold focus:border-transparent"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-semibold text-aureon-ocean mb-2"
                  >
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aureon-gold focus:border-transparent"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <label
                    htmlFor="organization"
                    className="block text-sm font-semibold text-aureon-ocean mb-2"
                  >
                    Organization
                  </label>
                  <input
                    type="text"
                    id="organization"
                    name="organization"
                    value={formData.organization}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aureon-gold focus:border-transparent"
                    placeholder="Your Healthcare Practice"
                  />
                </div>

                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-semibold text-aureon-ocean mb-2"
                  >
                    Subject *
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aureon-gold focus:border-transparent"
                  >
                    <option value="">Select a subject</option>
                    <option value="demo">Request a Demo</option>
                    <option value="sales">Sales Inquiry</option>
                    <option value="support">Technical Support</option>
                    <option value="partnership">Partnership Opportunities</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-semibold text-aureon-ocean mb-2"
                  >
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aureon-gold focus:border-transparent"
                    placeholder="Tell us how we can help you..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-aureon-amber to-aureon-ocean text-white py-4 rounded-lg font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg"
                >
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section (Placeholder) */}
      <section className="py-20 bg-gradient-aureon-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-12 text-gradient-aureon">
            Visit Our Office
          </h2>
          <div className="bg-gray-300 rounded-lg h-96 flex items-center justify-center">
            <p className="text-gray-600 text-lg">
              [Interactive Map Placeholder - Integrate Google Maps or similar service]
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-aureon-ocean to-aureon-blue py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-200 mb-8">
            Schedule a demo today and see how Aureon Health can transform your practice
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/product"
              className="bg-aureon-amber text-white px-8 py-3 rounded-full font-semibold hover:bg-white hover:text-aureon-ocean transition-all duration-300"
            >
              Learn More
            </a>
            <a
              href="tel:+15551234567"
              className="bg-transparent text-white border-2 border-white px-8 py-3 rounded-full font-semibold hover:bg-white hover:text-aureon-ocean transition-all duration-300"
            >
              Call Us Now
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
