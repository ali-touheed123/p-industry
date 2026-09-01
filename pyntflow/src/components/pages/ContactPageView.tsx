import React from 'react';
import { Breadcrumb } from '../seo/Breadcrumb';
import { MetaHead } from '../seo/MetaHead';
import { ContactUs } from '../ContactUs';
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';

interface ContactPageViewProps {
  onNavigate: (path: string) => void;
}

export const ContactPageView: React.FC<ContactPageViewProps> = ({ onNavigate }) => {
  const jsonLdSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      'name': 'Contact Pyntflow',
      'description': 'Contact the Pyntflow team for paint shop POS onboarding, custom hardware configuration, or product inquiries.',
      'mainEntity': {
        '@type': 'Organization',
        'name': 'Pyntflow',
        'url': 'https://pyntflow.com'
      }
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
          'name': 'Contact',
          'item': 'https://pyntflow.com/contact'
        }
      ]
    }
  ];

  return (
    <div className="pt-28 pb-20 bg-slate-50 min-h-screen">
      <MetaHead
        metadata={{
          title: 'Contact Pyntflow | Paint Shop POS Support & Onboarding',
          description: 'Get in touch with the Pyntflow team for paint store POS demos, hardware setup assistance, dealer inquiries, and direct customer support.',
          h1: 'Contact Pyntflow Support & Solutions Team',
          canonical: 'https://pyntflow.com/contact',
          keywords: [
            'contact Pyntflow',
            'paint shop POS demo',
            'paint POS support',
            'paint dealer software consultation'
          ],
          ogType: 'website'
        }}
        schema={jsonLdSchema}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ name: 'Contact', url: '/contact' }]} onNavigate={onNavigate} />

        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200/90 shadow-sm relative overflow-hidden mb-10 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-[#FF6B00] mb-4">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Direct Advisory & Support</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Let’s Discuss Your Paint Store Operations
          </h1>

          <p className="text-base text-slate-600 leading-relaxed font-normal mt-2">
            Whether you operate a single retail counter or manage multiple authorized dealership branches, our team is here to assist with setup and hardware guidance.
          </p>
        </div>

        {/* Existing Contact Us Form and Info Container */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-10">
          <ContactUs />
        </div>

      </div>
    </div>
  );
};
