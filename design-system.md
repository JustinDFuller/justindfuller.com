# Josh W. Comeau Design System Inventory

## Color Palette

### Primary Colors
- **Background (Dark Theme)**
  - Main: `#1a2332` (Deep navy blue)
  - Secondary: `#243447` (Slightly lighter navy)
  - Tertiary: `#2d3e51` (Medium navy for cards/sections)
  
- **Accent Colors**
  - Pink/Magenta: `#ff4c8b` (Primary accent for headings, CTAs)
  - Yellow: `#ffd93d` (Secondary accent for highlights, interactive elements)
  - Blue: `#4fc3f7` (Links, interactive elements)
  - Light Blue: `#64b5f6` (Hover states)

### Text Colors
- Primary text: `#ffffff` (White)
- Secondary text: `#9ca3af` (Light gray)
- Muted text: `#6b7280` (Medium gray)
- Code inline: `#ff4c8b` (Pink/magenta)

### UI Elements
- Borders: `#374151` (Dark gray)
- Card backgrounds: `#1f2937` (Dark blue-gray)
- Button backgrounds: `#374151` (Default), `#ff4c8b` (Primary CTA)
- Input backgrounds: `#1a1f2e` (Very dark blue)

## Typography System

### Font Families
- **Headings**: System font stack with fallbacks
  - Primary: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto
  - Monospace elements: "Fira Code", "Monaco", monospace

### Font Sizes
- **H1**: 3.5rem (56px) - Article titles
- **H2**: 2.25rem (36px) - Section headings
- **H3**: 1.875rem (30px) - Subsection headings
- **Body**: 1.125rem (18px) - Main content
- **Small**: 0.875rem (14px) - Meta information
- **Code**: 0.9rem (14.4px) - Inline code

### Font Weights
- Light: 300 (Meta text)
- Normal: 400 (Body text)
- Medium: 500 (Emphasized text)
- Bold: 700 (Headings)
- Extra Bold: 800 (Special headings)

### Line Heights
- Headings: 1.2
- Body text: 1.7
- Code blocks: 1.5

## Spacing System

### Base Unit: 4px
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px
- 3xl: 64px
- 4xl: 96px

### Container Widths
- Article content: 680px (max)
- Wide content: 900px (for interactive demos)
- Full width: 1200px (homepage)

### Section Spacing
- Between articles: 64px
- Between sections: 48px
- Paragraph spacing: 24px
- List item spacing: 12px

## Components

### Navigation Header
- **Structure**: Sticky header with logo, nav items, utility buttons
- **Elements**:
  - Logo with animated "W" reveal on hover
  - Search button
  - Sound toggle
  - Theme toggle (dark/light)
  - RSS feed link
  - Mobile menu hamburger

### Article Cards
- **Layout**: Vertical stack with hover effects
- **Elements**:
  - Title (H3 size)
  - Description text
  - "Read more" link with arrow icon
  - Category tag
  - Optional featured image

### Interactive Demos
- **Container**: Dark bordered box with rounded corners
- **Controls**: Sliders, buttons, dropdowns
- **Visual feedback**: Real-time updates, smooth transitions
- **Labels**: Clear labeling with units

### Code Blocks
- **Theme**: Dark background with syntax highlighting
- **Features**:
  - Copy button (top-right)
  - Language indicator
  - Line numbers (optional)
  - Horizontal scrolling for long lines

### Buttons
- **Primary**: Pink background, white text, rounded
- **Secondary**: Dark gray background, white text
- **Ghost**: Transparent with border
- **Icon**: Square with icon only

### Form Elements
- **Input fields**: Dark background, subtle border, placeholder text
- **Labels**: Above inputs, smaller font size
- **Submit buttons**: Matches primary button style

### Category Pills
- **Style**: Rounded rectangles with dark background
- **Hover**: Slight lightening of background
- **Text**: White, medium weight

### Footer
- **Sections**:
  - Newsletter signup
  - Course links
  - Navigation links
  - Social media icons
  - Copyright information
- **Design**: Wave/curve decoration at top

## Interactive Elements & Animations

### Hover Effects
- **Links**: Color shift to lighter shade
- **Cards**: Subtle shadow elevation
- **Buttons**: Background color shift
- **Images**: Slight scale transform

### Transitions
- **Duration**: 200-300ms for most interactions
- **Easing**: cubic-bezier curves for smooth motion
- **Properties**: color, background, transform, opacity

### Interactive Widgets
- **Sliders**: Custom styled with pink accent
- **Toggle switches**: Smooth sliding animation
- **Draggable elements**: Visual feedback with cursor change
- **Live demos**: Real-time updates without page refresh

### Loading States
- **Skeleton screens**: For content loading
- **Progress indicators**: For long operations
- **Smooth transitions**: Fade in/out effects

## Layout Patterns

### Grid Systems
- **Homepage**: 1-column mobile, 2-column tablet, 3-column desktop
- **Article**: Single column with max-width constraint
- **Popular content**: Horizontal scroll on mobile, grid on desktop

### Responsive Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Content Patterns
- **Hero sections**: Large title with decorative background
- **Article layout**: Title → Meta → Content → Footer
- **Interactive sections**: Explanation → Demo → Code
- **Call-out boxes**: Colored background with icon

## Visual Design Elements

### Decorative Elements
- **Wave patterns**: Used in backgrounds and section dividers
- **Gradient overlays**: Subtle color gradients on hero sections
- **Geometric shapes**: Circles and rounded rectangles as accents

### Icons
- **Style**: Outlined, consistent stroke width
- **Size**: 20px for inline, 24px for buttons
- **Color**: Inherits from parent or uses accent colors

### Images
- **Article heroes**: Full-width with gradient overlay
- **Inline images**: Max-width with centered alignment
- **Thumbnails**: Rounded corners with subtle shadow

## Accessibility Features

### Focus States
- **Visible outline**: 2px solid accent color
- **Keyboard navigation**: Full support with tab order
- **Skip links**: "Skip to content" for screen readers

### Color Contrast
- **Text on dark**: WCAG AAA compliant
- **Interactive elements**: Clear visual distinction
- **Error states**: Red with sufficient contrast

### Screen Reader Support
- **ARIA labels**: Comprehensive labeling
- **Semantic HTML**: Proper heading hierarchy
- **Alt text**: Descriptive for all images

## Design Principles

1. **Playful yet Professional**: Balances whimsy (animations, colors) with clarity
2. **Interactive Learning**: Demos enhance understanding
3. **Dark-First Design**: Optimized for reduced eye strain
4. **Progressive Enhancement**: Core content works without JavaScript
5. **Performance**: Fast loading with optimized assets
6. **Consistency**: Unified design language throughout

This design system creates a cohesive, engaging, and accessible experience that makes complex technical content approachable and enjoyable to learn.