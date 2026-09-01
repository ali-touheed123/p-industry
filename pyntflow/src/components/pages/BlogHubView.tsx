import React, { useState } from 'react';
import { Breadcrumb } from '../seo/Breadcrumb';
import { MetaHead } from '../seo/MetaHead';
import { BLOG_ARTICLES } from '../../data/blogArticles';
import { BlogArticle } from '../../types/seo';
import { 
  BookOpen, 
  Clock, 
  Calendar, 
  ArrowRight, 
  Search, 
  Tag, 
  User,
  Share2,
  ChevronRight
} from 'lucide-react';

interface BlogHubViewProps {
  onNavigate: (path: string) => void;
  selectedArticleSlug?: string;
}

export const BlogHubView: React.FC<BlogHubViewProps> = ({ onNavigate, selectedArticleSlug }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Guides & Fundamentals', 'Inventory & Operations', 'Billing & Invoicing', 'Dealers & Wholesale', 'Regional & Pakistan'];

  // Single Article View
  if (selectedArticleSlug) {
    const article = BLOG_ARTICLES.find((a) => a.slug === selectedArticleSlug);
    if (article) {
      const jsonLdSchema = [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          'headline': article.title,
          'description': article.excerpt,
          'author': {
            '@type': 'Organization',
            'name': 'Pyntflow',
            'url': 'https://pyntflow.com'
          },
          'publisher': {
            '@type': 'Organization',
            'name': 'Pyntflow',
            'logo': {
              '@type': 'ImageObject',
              'url': 'https://pyntflow.com/icon.svg'
            }
          },
          'datePublished': article.publishedDate,
          'mainEntityOfPage': `https://pyntflow.com/blog/${article.slug}`
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          'itemListElement': [
            {
              '@type': 'ListItem',
              'position': 1,
              'name': 'Home',
              'item': 'https://pyntflow.com/'
            },
            {
              '@type': 'ListItem',
              'position': 2,
              'name': 'Blog',
              'item': 'https://pyntflow.com/blog'
            },
            {
              '@type': 'ListItem',
              'position': 3,
              'name': article.title,
              'item': `https://pyntflow.com/blog/${article.slug}`
            }
          ]
        }
      ];

      return (
        <div className="pt-28 pb-20 bg-slate-50 min-h-screen">
          <MetaHead
            metadata={{
              title: `${article.title} | Pyntflow`,
              description: article.excerpt,
              h1: article.title,
              canonical: `https://pyntflow.com/blog/${article.slug}`,
              keywords: [article.targetKeyword, 'paint shop POS software', 'paint inventory management'],
              ogType: 'article'
            }}
            schema={jsonLdSchema}
          />

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumb 
              items={[
                { name: 'Blog', url: '/blog' },
                { name: article.title, url: `/blog/${article.slug}` }
              ]} 
              onNavigate={onNavigate} 
            />

            {/* Article Container */}
            <article className="bg-white rounded-3xl p-6 sm:p-10 md:p-12 border border-slate-200/90 shadow-sm space-y-8">
              
              {/* Header Meta */}
              <div className="space-y-4 border-b border-slate-100 pb-8">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="px-3 py-1 bg-orange-50 text-[#FF6B00] font-bold rounded-full border border-orange-100">
                    {article.category}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{article.publishedDate}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{article.readTime}</span>
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  {article.title}
                </h1>

                <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
                  {article.excerpt}
                </p>

                <div className="flex items-center gap-3 pt-2 text-xs font-mono text-slate-500">
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{article.author}</span>
                  </span>
                </div>
              </div>

              {/* Table of Contents */}
              {article.tableOfContents && article.tableOfContents.length > 0 && (
                <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
                  <div className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                    TABLE OF CONTENTS
                  </div>
                  <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700">
                    {article.tableOfContents.map((toc) => (
                      <li key={toc.id}>
                        <a href={`#${toc.id}`} className="hover:text-[#FF6B00] transition-colors flex items-center gap-1.5">
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                          <span>{toc.title}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Intro Body */}
              <div className="text-slate-700 leading-relaxed text-base font-normal space-y-4">
                <p>{article.content.intro}</p>
              </div>

              {/* Core Content Sections */}
              <div className="space-y-8 pt-4">
                {article.content.sections.map((section) => (
                  <section key={section.id} id={section.id} className="space-y-3.5 scroll-mt-28">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                      {section.heading}
                    </h2>

                    {section.body.map((bText, bIdx) => (
                      <p key={bIdx} className="text-slate-700 text-sm sm:text-base leading-relaxed">
                        {bText}
                      </p>
                    ))}

                    {section.keyTakeaway && (
                      <div className="p-4 bg-orange-50/70 border-l-4 border-[#FF6B00] rounded-r-xl text-xs sm:text-sm text-slate-800 font-medium">
                        <strong className="text-[#FF6B00] font-bold">Key Takeaway: </strong>
                        {section.keyTakeaway}
                      </div>
                    )}

                    {section.internalLink && (
                      <div className="pt-2">
                        <button
                          onClick={() => onNavigate(section.internalLink!.url)}
                          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#FF6B00] hover:text-[#E55F00] underline underline-offset-4 cursor-pointer"
                        >
                          <span>{section.internalLink.text}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </section>
                ))}
              </div>

              {/* Article FAQ Section */}
              {article.content.faqSection && article.content.faqSection.length > 0 && (
                <div className="p-6 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-4 mt-8">
                  <div className="text-xs font-mono font-bold text-[#FF6B00] uppercase tracking-wider">
                    QUESTIONS ANSWERED IN THIS GUIDE
                  </div>
                  <div className="divide-y divide-slate-200">
                    {article.content.faqSection.map((faq, fIdx) => (
                      <div key={fIdx} className="py-3 space-y-1">
                        <div className="text-sm font-bold text-slate-900">{faq.question}</div>
                        <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">{faq.answer}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conclusion & Related Link */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Summary & Next Steps</h3>
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                  {article.content.conclusion}
                </p>

                <div className="p-5 bg-[#0A0F1D] text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                  <div>
                    <div className="text-xs font-mono text-slate-400 uppercase">Featured Pyntflow Solution</div>
                    <div className="text-base font-bold text-white mt-0.5">{article.content.relatedProductText}</div>
                  </div>
                  <button
                    onClick={() => onNavigate(article.content.relatedProductUrl)}
                    className="px-5 py-2.5 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <span>View Software Module</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </article>

            {/* Back to Blog Button */}
            <div className="mt-8 text-center">
              <button
                onClick={() => onNavigate('/blog')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                <span>← Back to All Articles</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Blog Hub View (All 15 Articles List)
  const filteredArticles = BLOG_ARTICLES.filter((art) => {
    const matchesSearch = 
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.targetKeyword.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || art.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="pt-28 pb-20 bg-slate-50 min-h-screen">
      <MetaHead
        metadata={{
          title: 'Paint Shop POS & Retail Management Blog | Pyntflow',
          description: 'Practical guides, inventory strategies, billing workflows, and retail insights for paint shops, paint stores, and paint dealers.',
          h1: 'Paint Shop POS & Management Knowledge Hub',
          canonical: 'https://pyntflow.com/blog',
          keywords: [
            'paint shop POS software',
            'paint store inventory management',
            'paint shop billing software',
            'paint dealer software',
            'paint retail software guide'
          ],
          ogType: 'website'
        }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ name: 'Blog', url: '/blog' }]} onNavigate={onNavigate} />

        {/* Hub Header */}
        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200/90 shadow-sm relative overflow-hidden mb-10">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-[#FF6B00]">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Topical Knowledge Hub</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Paint Retail & POS Management Guides
            </h1>

            <p className="text-base text-slate-600 leading-relaxed font-normal">
              Explore practical guides, inventory optimization frameworks, and billing best practices for paint shops, retail stores, and authorized paint dealers.
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto no-scrollbar pb-1 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#0A0F1D] text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="w-full md:w-72 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search guides or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF6B00]"
            />
          </div>
        </div>

        {/* 15 Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredArticles.map((art) => (
            <div
              key={art.slug}
              onClick={() => onNavigate(`/blog/${art.slug}`)}
              className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-orange-300 transition-all flex flex-col justify-between cursor-pointer group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded-md border border-slate-200">
                    {art.category}
                  </span>
                  <span>{art.readTime}</span>
                </div>

                <h2 className="text-base font-bold text-slate-900 group-hover:text-[#FF6B00] transition-colors leading-snug">
                  {art.title}
                </h2>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                  {art.excerpt}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#FF6B00] mt-4">
                <span>Read Full Guide</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Knowledge Summary */}
        <div className="p-6 bg-slate-100 rounded-2xl border border-slate-200 text-center space-y-2">
          <div className="text-xs font-mono font-bold text-slate-500 uppercase">
            Topical Authority Coverage: 15 Comprehensive Paint Retail Guides
          </div>
          <p className="text-xs text-slate-500 max-w-xl mx-auto">
            All Pyntflow articles are grounded in real paint store operations, addressing base inventory, contractor khata, multi-pack pricing, and counter hotkey workflows.
          </p>
        </div>

      </div>
    </div>
  );
};
