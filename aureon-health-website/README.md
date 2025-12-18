# Aureon Health - Marketing Website

A modern, responsive marketing and outreach website for Aureon Health, showcasing our healthcare solutions and team.

## Overview

This website serves as the primary marketing platform for Aureon Health, featuring:

- **Home Page**: Engaging hero section with key features and call-to-action
- **About Us**: Company story, mission, vision, and values
- **Product**: Comprehensive overview of the Aureon Health platform and features
- **Team**: Meet our leadership team and departments
- **Contact**: Contact form and information for getting in touch

## Design

The website features a beautiful gradient color palette:
- **Gold/Amber**: #FFB347, #F4A460
- **Ocean Blue**: #0C4A6E, #1E3A8A
- Smooth gradient transitions throughout the site

## Tech Stack

- **Framework**: Next.js 14 (React)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Icons**: React Icons
- **Deployment Ready**: Vercel, Netlify, or any Node.js hosting

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd aureon-health-website
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
aureon-health-website/
├── src/
│   ├── app/
│   │   ├── about/          # About Us page
│   │   ├── contact/        # Contact page
│   │   ├── product/        # Product page
│   │   ├── team/           # Team page
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Home page
│   │   └── globals.css     # Global styles
│   └── components/
│       ├── Navbar.tsx      # Navigation component
│       └── Footer.tsx      # Footer component
├── public/                 # Static assets
├── tailwind.config.js      # Tailwind configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies
```

## Features

- ✅ Fully responsive design
- ✅ Modern gradient color scheme
- ✅ SEO optimized
- ✅ Fast page loads with Next.js
- ✅ Mobile-friendly navigation
- ✅ Contact form functionality
- ✅ TypeScript for type safety

## Customization

### Colors

Edit `tailwind.config.js` to customize the color palette:

```javascript
colors: {
  'aureon-gold': '#F4A460',
  'aureon-amber': '#FFB347',
  'aureon-blue': '#1E3A8A',
  'aureon-ocean': '#0C4A6E',
}
```

### Content

- Page content is located in `src/app/*/page.tsx`
- Update team members in `src/app/team/page.tsx`
- Modify contact information in `src/app/contact/page.tsx` and `src/components/Footer.tsx`

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Deploy with one click

### Netlify

1. Connect repository
2. Build command: `npm run build`
3. Publish directory: `.next`

## License

Copyright © 2025 Aureon Health. All rights reserved.

## Support

For questions or support, contact: info@aureonhealth.com
