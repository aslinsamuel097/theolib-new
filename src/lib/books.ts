
export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  coverUrl: string;
  previewText: string;
  year: number;
}

export const books: Book[] = [
  {
    id: '1',
    title: 'Institutes of the Christian Religion',
    author: 'John Calvin',
    category: 'Systematic Theology',
    description: 'A seminal work in Protestant theology that covers the essential doctrines of the Christian faith.',
    coverUrl: 'https://picsum.photos/seed/bible1/400/600',
    year: 1536,
    previewText: 'Book I: Of the Knowledge of God the Creator. CHAPTER I. THE KNOWLEDGE OF GOD AND THAT OF OURSELVES ARE CONNECTED. HOW THEY ARE RESPECTIVELY PRODUCED...'
  },
  {
    id: '2',
    title: 'Summa Theologica',
    author: 'Thomas Aquinas',
    category: 'Scholasticism',
    description: 'One of the most influential works of Western literature, intended as an instructional guide for theology students.',
    coverUrl: 'https://picsum.photos/seed/bible2/400/600',
    year: 1265,
    previewText: 'Whether the existence of God is self-evident? We proceed thus to the First Article: It seems that the existence of God is self-evident. For those things are said to be self-evident to us for which the knowledge is naturally implanted in us...'
  },
  {
    id: '3',
    title: 'The City of God',
    author: 'Augustine of Hippo',
    category: 'Philosophy',
    description: 'A cornerstone of Western thought, Augustine examines the relationship between the Church and the world.',
    coverUrl: 'https://picsum.photos/seed/bible3/400/600',
    year: 426,
    previewText: 'The glorious city of God is my theme in this work, which you, my dearest son Marcellinus, suggested, and which is due to you by my promise...'
  },
  {
    id: '4',
    title: 'Church Dogmatics',
    author: 'Karl Barth',
    category: 'Modern Theology',
    description: 'One of the most important theological works of the 20th century, exploring the doctrine of the Word of God.',
    coverUrl: 'https://picsum.photos/seed/bible4/400/600',
    year: 1932,
    previewText: 'Dogmatics is a self-examination of the Christian Church with respect to the content of its distinctive talk about God...'
  },
  {
    id: '5',
    title: 'The Bondage of the Will',
    author: 'Martin Luther',
    category: 'Reformation',
    description: 'Luther\'s response to Erasmus, focusing on the sovereignty of God and the nature of human will.',
    coverUrl: 'https://picsum.photos/seed/bible5/400/600',
    year: 1525,
    previewText: 'Venerable Erasmus, I have waited for a long time to answer your Diatribe on Free Will, as I was hoping for some better opportunity...'
  },
  {
    id: '6',
    title: 'Pensées',
    author: 'Blaise Pascal',
    category: 'Apologetics',
    description: 'A collection of fragments on theology and philosophy, famously containing "Pascal\'s Wager".',
    coverUrl: 'https://picsum.photos/seed/bible6/400/600',
    year: 1670,
    previewText: 'Man is but a reed, the most feeble thing in nature, but he is a thinking reed. The entire universe need not arm itself to crush him...'
  }
];
