# Deployment Guide for Aureon Health Website

## Creating GitHub Repository

Since the code is already committed locally, follow these steps to create a GitHub repository:

### Option 1: Using GitHub CLI (if available)

```bash
cd /home/user/aureon-health-website
gh repo create aureon-health-website --public --source=. --description="Marketing and outreach website for Aureon Health" --push
```

### Option 2: Manual GitHub Repository Creation

1. Go to [GitHub](https://github.com) and log in
2. Click the "+" icon in the top right and select "New repository"
3. Name it: `aureon-health-website`
4. Description: "Marketing and outreach website for Aureon Health - Healthcare solutions platform"
5. Choose "Public" or "Private" as needed
6. **Do NOT** initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

8. Connect your local repository to GitHub:
```bash
cd /home/user/aureon-health-website
git remote add origin https://github.com/YOUR_USERNAME/aureon-health-website.git
git branch -M main
git push -u origin main
```

## Deploying to Vercel (Recommended)

Vercel is the easiest way to deploy Next.js applications:

1. Go to [vercel.com](https://vercel.com)
2. Sign up or log in with your GitHub account
3. Click "Add New Project"
4. Import your `aureon-health-website` repository
5. Configure project:
   - Framework Preset: Next.js
   - Root Directory: `./`
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `.next` (auto-detected)
6. Click "Deploy"

Your site will be live at: `https://aureon-health-website.vercel.app`

### Custom Domain (Optional)

1. In Vercel project settings, go to "Domains"
2. Add your custom domain (e.g., `www.aureonhealth.com`)
3. Follow DNS configuration instructions

## Deploying to Netlify

1. Go to [netlify.com](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect to GitHub and select `aureon-health-website`
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
5. Click "Deploy site"

## Deploying to Other Platforms

### AWS Amplify

1. Go to AWS Amplify Console
2. Click "New app" → "Host web app"
3. Connect your GitHub repository
4. Configure build settings (auto-detected for Next.js)
5. Deploy

### DigitalOcean App Platform

1. Go to DigitalOcean Apps
2. Create new app from GitHub repository
3. Select Node.js environment
4. Deploy

## Local Development

Before deploying, test locally:

```bash
cd /home/user/aureon-health-website

# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Production Build Testing

Test the production build locally:

```bash
# Build for production
npm run build

# Start production server
npm start

# Open http://localhost:3000
```

## Environment Variables

If you need to add environment variables (e.g., for contact form backend):

1. Create `.env.local` file:
```
NEXT_PUBLIC_API_URL=https://api.yourbackend.com
CONTACT_FORM_EMAIL=info@aureonhealth.com
```

2. Add to `.gitignore` (already included)
3. Add to your hosting platform's environment variables

## Post-Deployment Checklist

- [ ] Test all pages load correctly
- [ ] Verify responsive design on mobile
- [ ] Test contact form functionality
- [ ] Check navigation links
- [ ] Verify SEO meta tags
- [ ] Test page load speed
- [ ] Set up custom domain (if applicable)
- [ ] Configure SSL certificate (usually automatic)
- [ ] Set up analytics (Google Analytics, etc.)
- [ ] Test on multiple browsers

## Updating the Website

After making changes:

```bash
git add .
git commit -m "Description of changes"
git push
```

Your hosting platform will automatically redeploy the updated site.

## Support

For deployment issues, consult:
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Netlify Documentation](https://docs.netlify.com)
