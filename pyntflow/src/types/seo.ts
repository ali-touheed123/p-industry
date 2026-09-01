export interface BlogArticle {
  slug: string;
  title: string;
  targetKeyword: string;
  excerpt: string;
  readTime: string;
  publishedDate: string;
  author: string;
  category: string;
  tableOfContents: { id: string; title: string }[];
  content: {
    intro: string;
    sections: {
      id: string;
      heading: string;
      body: string[];
      keyTakeaway?: string;
      bulletPoints?: string[];
      internalLink?: {
        text: string;
        url: string;
      };
    }[];
    faqSection?: {
      question: string;
      answer: string;
    }[];
    conclusion: string;
    relatedProductUrl: string;
    relatedProductText: string;
  };
}

export interface SeoPageMetadata {
  title: string;
  description: string;
  h1: string;
  canonical: string;
  keywords: string[];
  ogType?: 'website' | 'article' | 'product';
  schemaType?: 'Organization' | 'SoftwareApplication' | 'FAQPage' | 'Article';
}
