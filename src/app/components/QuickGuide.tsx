import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { HelpCircle, X, Camera, Droplets, DollarSign, User } from 'lucide-react';

export const QuickGuide: React.FC = () => {
  const { state } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const lang = state.language;

  const guides = [
    {
      icon: Camera,
      title: lang === 'bn' ? 'রোগ শনাক্ত' : 'Disease Detection',
      description: lang === 'bn' 
        ? 'পাতার ছবি তুলুন বা আপলোড করুন। তাৎক্ষণিক পরামর্শ এবং বিশেষজ্ঞের সাথে কথা বলুন।'
        : 'Take or upload leaf photos. Get instant advice and consult experts.',
    },
    {
      icon: Droplets,
      title: lang === 'bn' ? 'সেচ ব্যবস্থাপনা' : 'Irrigation Management',
      description: lang === 'bn'
        ? 'আর্দ্রতা মনিটর করুন। স্বয়ংক্রিয় মোড সক্ষম করুন বা ম্যানুয়ালি নিয়ন্ত্রণ করুন।'
        : 'Monitor moisture levels. Enable auto mode or control manually.',
    },
    {
      icon: DollarSign,
      title: lang === 'bn' ? 'বাজার মূল্য' : 'Market Prices',
      description: lang === 'bn'
        ? 'বিভিন্ন বাজারের দাম দেখুন। প্রিয় ফসল সংরক্ষণ করুন এবং মূল্য সতর্কতা সেট করুন।'
        : 'View prices across markets. Save favorites and set price alerts.',
    },
    {
      icon: User,
      title: lang === 'bn' ? 'প্রোফাইল এবং সিঙ্ক' : 'Profile & Sync',
      description: lang === 'bn'
        ? 'অতিথি মোডে সব কিছু অফলাইনে কাজ করে। সিঙ্ক এবং রিয়েল-টাইম সতর্কতার জন্য লগইন করুন।'
        : 'Everything works offline in guest mode. Login for sync and real-time alerts.',
    },
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-40 right-4 lg:bottom-24 lg:right-8 z-20 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/20 hover:scale-105 hover:shadow-xl transition-all flex items-center justify-center"
        aria-label={lang === 'bn' ? 'সাহায্য' : 'Help'}
      >
        <HelpCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-3xl border border-border/70 bg-card/95 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border/70 bg-card/95 p-4 backdrop-blur-xl">
          <h2 className="text-xl font-semibold">{lang === 'bn' ? 'দ্রুত গাইড' : 'Quick Guide'}</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-muted-foreground">
            {lang === 'bn'
              ? 'Smart Farming System ব্যবহারের মূল বৈশিষ্ট্য এবং টিপস।'
              : 'Key features and tips for using the Smart Farming System.'}
          </p>

          {guides.map((guide, idx) => (
            <div key={idx} className="flex gap-4 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
              <div className="flex-shrink-0">
                <guide.icon className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">{guide.title}</h3>
                <p className="text-sm text-muted-foreground">{guide.description}</p>
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-primary/15 bg-primary/10 p-4">
            <h3 className="font-semibold text-foreground mb-2">
              {lang === 'bn' ? 'অফলাইন মোড' : 'Offline Mode'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {lang === 'bn'
                ? 'সমস্ত বৈশিষ্ট্য ইন্টারনেট ছাড়াই কাজ করে। আপনার ডেটা স্থানীয়ভাবে সংরক্ষিত থাকে। লগইন করলে ক্লাউড সিঙ্ক এবং রিয়েল-টাইম আপডেট পাবেন।'
                : 'All features work without internet. Your data is stored locally. Login to enable cloud sync and real-time updates.'}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 p-4">
            <h3 className="font-semibold text-foreground mb-2">
              {lang === 'bn' ? 'বিশেষজ্ঞ পরামর্শ' : 'Expert Consultation'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {lang === 'bn'
                ? 'রোগ শনাক্তের পর চ্যাট বা কলের মাধ্যমে যাচাইকৃত কৃষিবিদদের সাথে কথা বলুন।'
                : 'After disease detection, consult with verified agricultural experts via chat or call.'}
            </p>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="w-full rounded-xl bg-primary px-4 py-2 text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
          >
            {lang === 'bn' ? 'বুঝেছি' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
