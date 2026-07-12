# Font Files

Place your licensed font files in this directory.

## Required Font Files:

### PP Playground Medium
- `PPPlayground-Medium.woff2`
- `PPPlayground-Medium.woff`

### PP Watch Bold
- `PPWatch-Bold.woff2`
- `PPWatch-Bold.woff`

### Sentient Regular
- `Sentient-Regular.woff2`
- `Sentient-Regular.woff`

## How to Add Fonts:

1. **Convert your font files to web formats** (WOFF2 and WOFF)
   - You can use online converters like https://transfonter.org/
   - WOFF2 is the modern format (smaller file size)
   - WOFF is the fallback for older browsers

2. **Name the files exactly as listed above**

3. **Place them in this `/fonts` directory**

4. The CSS is already configured to use these fonts:
   - **PP Playground Medium**: Used for titles and decorative text (couple names, "Thank You!")
   - **PP Watch Bold**: Used for headings and navigation
   - **Sentient Regular**: Used for body text and paragraphs

## Font Usage on the Site:

- **Title/Script font** (`--font-title`): PP Playground Medium
  - Couple names
  - "Thank You!" confirmation message
  - Decorative headings

- **Heading font** (`--font-heading`): PP Watch Bold
  - Navigation menu
  - Section headings
  - Event labels
  - Form labels

- **Body font** (`--font-body`): Sentient Regular
  - Paragraph text
  - Form inputs
  - Descriptive text

## Note:

Until you add the actual font files, the site will use fallback system fonts:
- Brush Script MT (for titles)
- Helvetica Neue (for headings)
- Baskerville (for body text)
