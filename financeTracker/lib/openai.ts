import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ReceiptItem {
  name: string;
  price: number; // in cents
  quantity?: number;
  unitPrice?: number;
}

export interface CategorizedItem extends ReceiptItem {
  cleanName: string;
  category: string;
  isDiscount?: boolean;
  isTax?: boolean;
  isFee?: boolean;
}

export interface ReceiptMetadata {
  cardUsed: string | null;
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  discount: number | null;
  fees: number | null;
}

export async function categorizeReceiptItems(
  items: ReceiptItem[],
  rawText?: string
): Promise<{ items: CategorizedItem[]; metadata: ReceiptMetadata }> {
  const defaultMetadata: ReceiptMetadata = {
    cardUsed: null,
    subtotal: null,
    tax: null,
    tip: null,
    discount: null,
    fees: null,
  };

  if (!items.length) return { items: [], metadata: defaultMetadata };

  const itemList = items.map((item, i) => 
    `${i + 1}. "${item.name}" - $${(item.price / 100).toFixed(2)}`
  ).join('\n');

  const prompt = `Analyze this receipt data and categorize items.

ITEMS:
${itemList}

INSTRUCTIONS:
1. For each item, determine:
   - cleanName: readable product name (e.g., "Kroger® Handmade Style Flour Tortillas 8ct" → "Flour Tortillas")
   - category: Groceries, Personal Care, Household, Electronics, Dining, Transportation, Entertainment, Healthcare, Clothing, or Other
   - isDiscount: true if this is a discount/coupon (negative or has words like "discount", "off", "savings")
   - isTax: true if this is tax
   - isFee: true if this is a fee (delivery, service, bag fee, etc.)

2. Also extract receipt metadata if visible in item names:
   - cardUsed: payment method (e.g., "Visa ****1234", "Apple Pay", "Cash")
   - subtotal: subtotal before tax (in cents)
   - tax: total tax (in cents)  
   - tip: tip amount if any (in cents)
   - discount: total discounts (in cents, positive number)
   - fees: total fees (in cents)

RESPOND with JSON only:
{
  "items": [
    { "index": 1, "cleanName": "...", "category": "...", "isDiscount": false, "isTax": false, "isFee": false },
    ...
  ],
  "metadata": {
    "cardUsed": "Visa ****1234" or null,
    "subtotal": 1299 or null,
    "tax": 87 or null,
    "tip": null,
    "discount": 200 or null,
    "fees": 399 or null
  }
}`;

  console.log(`[OpenAI] Categorizing ${items.length} items...`);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content?.trim();
    console.log(`[OpenAI] Raw response:\n${content}`);
    
    if (!content) {
      console.error('[OpenAI] Empty response');
      return { 
        items: items.map(item => ({ ...item, cleanName: item.name, category: 'Other' })), 
        metadata: defaultMetadata 
      };
    }

    let jsonStr = content;
    if (content.startsWith('```')) {
      jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const parsed = JSON.parse(jsonStr) as {
      items: Array<{ index: number; cleanName: string; category: string; isDiscount?: boolean; isTax?: boolean; isFee?: boolean }>;
      metadata: ReceiptMetadata;
    };

    console.log(`[OpenAI] Parsed ${parsed.items.length} items, metadata:`, parsed.metadata);

    const categorizedItems = items.map((item, i) => {
      const match = parsed.items.find(p => p.index === i + 1);
      return {
        ...item,
        cleanName: match?.cleanName || item.name,
        category: match?.category || 'Other',
        isDiscount: match?.isDiscount || false,
        isTax: match?.isTax || false,
        isFee: match?.isFee || false,
      };
    });

    return { items: categorizedItems, metadata: parsed.metadata || defaultMetadata };

  } catch (error) {
    console.error('Error categorizing items with OpenAI:', error);
    return { 
      items: items.map(item => ({ ...item, cleanName: item.name, category: 'Other' })), 
      metadata: defaultMetadata 
    };
  }
}
