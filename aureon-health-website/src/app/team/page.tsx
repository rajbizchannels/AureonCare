import { FaLinkedin, FaTwitter, FaEnvelope } from 'react-icons/fa'

export default function Team() {
  const teamMembers = [
    {
      name: 'Dr. Sarah Johnson',
      role: 'Chief Executive Officer',
      bio: 'Board-certified physician with 15+ years of experience in healthcare technology and practice management.',
      initials: 'SJ',
      gradient: 'from-aureon-amber to-aureon-gold',
    },
    {
      name: 'Michael Chen',
      role: 'Chief Technology Officer',
      bio: 'Former lead architect at major health tech companies, specializing in scalable healthcare solutions.',
      initials: 'MC',
      gradient: 'from-aureon-gold to-aureon-ocean',
    },
    {
      name: 'Dr. Emily Rodriguez',
      role: 'Chief Medical Officer',
      bio: 'Practicing physician and healthcare innovator focused on improving clinical workflows and patient outcomes.',
      initials: 'ER',
      gradient: 'from-aureon-ocean to-aureon-blue',
    },
    {
      name: 'David Thompson',
      role: 'VP of Product',
      bio: 'Product strategist with a passion for user-centered design and healthcare innovation.',
      initials: 'DT',
      gradient: 'from-aureon-amber to-aureon-ocean',
    },
    {
      name: 'Lisa Martinez',
      role: 'VP of Operations',
      bio: 'Operations expert ensuring seamless delivery and exceptional customer success.',
      initials: 'LM',
      gradient: 'from-aureon-gold to-aureon-blue',
    },
    {
      name: 'James Williams',
      role: 'Head of Engineering',
      bio: 'Software engineering leader building robust, scalable healthcare platforms.',
      initials: 'JW',
      gradient: 'from-aureon-amber to-aureon-blue',
    },
    {
      name: 'Dr. Priya Patel',
      role: 'Director of Clinical Innovation',
      bio: 'Clinical researcher and innovator bridging the gap between medicine and technology.',
      initials: 'PP',
      gradient: 'from-aureon-ocean to-aureon-amber',
    },
    {
      name: 'Robert Anderson',
      role: 'Head of Security & Compliance',
      bio: 'Cybersecurity expert ensuring HIPAA compliance and data protection.',
      initials: 'RA',
      gradient: 'from-aureon-blue to-aureon-gold',
    },
  ]

  const departments = [
    {
      name: 'Leadership',
      description: 'Guiding our vision and strategy',
      color: 'aureon-amber',
    },
    {
      name: 'Engineering',
      description: 'Building innovative solutions',
      color: 'aureon-gold',
    },
    {
      name: 'Clinical',
      description: 'Ensuring medical excellence',
      color: 'aureon-ocean',
    },
    {
      name: 'Customer Success',
      description: 'Supporting your success',
      color: 'aureon-blue',
    },
  ]

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-aureon-amber via-aureon-gold to-aureon-ocean py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
            Meet Our Team
          </h1>
          <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto drop-shadow">
            Passionate professionals dedicated to transforming healthcare through innovation
            and excellence
          </p>
        </div>
      </section>

      {/* Team Introduction */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6 text-gradient-aureon">
            The People Behind Aureon Health
          </h2>
          <p className="text-xl text-gray-700 leading-relaxed">
            Our team brings together healthcare professionals, technology experts, and
            innovators who share a common vision: to make healthcare better for everyone. With
            decades of combined experience in medicine, technology, and business, we&apos;re
            uniquely positioned to understand and solve the challenges facing healthcare
            providers today.
          </p>
        </div>
      </section>

      {/* Team Members Grid */}
      <section className="py-20 bg-gradient-aureon-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-16 text-gradient-aureon">
            Leadership Team
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {teamMembers.map((member, index) => (
              <div
                key={index}
                className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow overflow-hidden"
              >
                <div className="p-6">
                  {/* Avatar */}
                  <div className="flex justify-center mb-4">
                    <div
                      className={`w-32 h-32 rounded-full bg-gradient-to-br ${member.gradient} flex items-center justify-center`}
                    >
                      <span className="text-white text-3xl font-bold">
                        {member.initials}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-aureon-ocean mb-2">
                      {member.name}
                    </h3>
                    <p className="text-aureon-gold font-semibold mb-3">{member.role}</p>
                    <p className="text-gray-600 text-sm leading-relaxed mb-4">
                      {member.bio}
                    </p>

                    {/* Social Links */}
                    <div className="flex justify-center space-x-4">
                      <a
                        href="#"
                        className="text-aureon-ocean hover:text-aureon-amber transition-colors"
                      >
                        <FaLinkedin size={20} />
                      </a>
                      <a
                        href="#"
                        className="text-aureon-ocean hover:text-aureon-amber transition-colors"
                      >
                        <FaTwitter size={20} />
                      </a>
                      <a
                        href="#"
                        className="text-aureon-ocean hover:text-aureon-amber transition-colors"
                      >
                        <FaEnvelope size={20} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Departments */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-16 text-gradient-aureon">
            Our Departments
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {departments.map((dept, index) => (
              <div
                key={index}
                className="text-center p-8 rounded-lg bg-gradient-aureon-light hover:shadow-lg transition-shadow"
              >
                <div
                  className={`w-16 h-16 mx-auto mb-4 rounded-full bg-${dept.color} flex items-center justify-center`}
                >
                  <span className="text-white text-2xl font-bold">
                    {dept.name.charAt(0)}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-aureon-ocean mb-2">{dept.name}</h3>
                <p className="text-gray-600">{dept.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Join Our Team */}
      <section className="py-20 bg-gradient-aureon-light">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6 text-gradient-aureon">Join Our Mission</h2>
          <p className="text-xl text-gray-700 mb-8">
            We&apos;re always looking for talented, passionate individuals to join our team.
            If you&apos;re excited about transforming healthcare, we&apos;d love to hear from
            you.
          </p>
          <a
            href="/contact"
            className="inline-block bg-gradient-to-r from-aureon-amber to-aureon-ocean text-white px-10 py-4 rounded-full font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg"
          >
            View Open Positions
          </a>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-aureon-ocean to-aureon-blue py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Let&apos;s Work Together
          </h2>
          <p className="text-xl text-gray-200 mb-8">
            Ready to see how our team can help transform your healthcare practice?
          </p>
          <a
            href="/contact"
            className="inline-block bg-aureon-amber text-white px-8 py-3 rounded-full font-semibold hover:bg-white hover:text-aureon-ocean transition-all duration-300"
          >
            Get in Touch
          </a>
        </div>
      </section>
    </div>
  )
}
