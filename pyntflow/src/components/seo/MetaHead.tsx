import React, { useEffect } from 'react';
import { SeoPageMetadata } from '../types/seo';

interface MetaHeadProps {
  metadata: SeoPageMetadata;
  schema?: object | object[];
}

export const MetaHead: React.FC<MetaHeadProps> = ({ metadata, schema }) => {
  useEffect(() => {
    // 1. Update Title
    document.title = metadata.title;

    // 2. Update Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', metadata.description);

    // 3. Update Meta Keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', metadata.keywords.join(', '));

    // 4. Update Canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', metadata.canonical);

    // 5. Open Graph Meta Tags
    const ogTags: Record<string, string> = {
      'og:title': metadata.title,
      'og:description': metadata.description,
      'og:url': metadata.canonical,
      'og:type': metadata.ogType || 'website',
      'og:site_name': 'Pyntflow',
      'twitter:card': 'summary_large_image',
      'twitter:title': metadata.title,
      'twitter:description': metadata.description
    };

    Object.entries(ogTags).forEach(([property, content]) => {
      const isTwitter = property.startsWith('twitter:');
      const attr = isTwitter ? 'name' : 'property';
      let tag = document.querySelector(`meta[${attr}="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    });

    // 6. JSON-LD Schema
    const existingScript = document.getElementById('pyntflow-jsonld-schema');
    if (existingScript) {
      existingScript.remove();
    }

    if (schema) {
      const script = document.createElement('script');
      script.id = 'pyntflow-jsonld-schema';
      script.type = 'application/ld+json';
      script.text = JSON.stringify(schema);
      document.head.appendChild(script);
    }

    // Scroll to top on route change
    window.scrollTo(0, 0);
  }, [metadata, schema]);

  return null;
};
