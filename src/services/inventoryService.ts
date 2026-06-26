import { supabase } from '../lib/supabase';
import { Product, Category } from '../types';
import { useAuthStore } from '../store/authStore';

// Helper to map Supabase database columns to frontend CamelCase
const mapDbProduct = (db: any): Product => {
  return {
    id: db.id,
    companyId: db.company_id,
    categoryId: db.category_id,
    category: db.categories ? {
      id: db.categories.id,
      companyId: db.categories.company_id,
      name: db.categories.name,
      createdAt: db.categories.created_at,
    } : undefined,
    name: db.name,
    description: db.description || '',
    sku: db.sku,
    barcode: db.barcode || '',
    unit: db.unit,
    costPrice: Number(db.cost_price || 0),
    salePrice: Number(db.sale_price || 0),
    currentQuantity: Number(db.current_quantity ?? 0),
    minQuantity: Number(db.min_quantity ?? 0),
    maxQuantity: Number(db.max_quantity ?? 0),
    isActive: db.is_active,
    createdAt: db.created_at || db.createdAt,
  };
};

const mapDbCategory = (db: any): Category => ({
  id: db.id,
  companyId: db.company_id,
  name: db.name,
  createdAt: db.created_at || db.createdAt,
});

/**
 * List categories belonging to the current tenant
 */
export const getCategories = async (): Promise<Category[]> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', companyId)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapDbCategory);
};

/**
 * Creates a new product category
 */
export const createCategory = async (name: string): Promise<Category> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  const newId = crypto.randomUUID();

  const { data, error } = await supabase
    .from('categories')
    .insert({ id: newId, company_id: companyId, name })
    .select()
    .single();

  if (error) throw error;
  return mapDbCategory(data);
};

/**
 * List products with filters
 */
export interface ProductFilters {
  search?: string;
  categoryId?: string;
  stockStatus?: 'all' | 'available' | 'low' | 'out';
}

export const getProducts = async (filters?: ProductFilters): Promise<Product[]> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  let query = supabase
    .from('products')
    .select('*, categories(*)')
    .eq('company_id', companyId)
    .order('name', { ascending: true });

  if (filters?.categoryId && filters.categoryId !== 'all') {
    query = query.eq('category_id', filters.categoryId);
  }

  if (filters?.search) {
    const searchVal = `%${filters.search}%`;
    query = query.or(`name.ilike.${searchVal},sku.ilike.${searchVal}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  let result = (data || []).map(mapDbProduct);

  if (filters?.stockStatus && filters.stockStatus !== 'all') {
    result = result.filter(p => {
      if (filters.stockStatus === 'out') return p.currentQuantity === 0;
      if (filters.stockStatus === 'low') return p.currentQuantity > 0 && p.currentQuantity <= p.minQuantity;
      if (filters.stockStatus === 'available') return p.currentQuantity > p.minQuantity;
      return true;
    });
  }

  return result;
};

/**
 * Fetch detailed product info and movement logs
 */
export interface ProductDetailData {
  product: Product;
  history: {
    id: string;
    saleId: string;
    date: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    customerName: string;
  }[];
}

export const getProductById = async (id: string): Promise<ProductDetailData> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data: dbProd, error: prodErr } = await supabase
    .from('products')
    .select('*, categories(*)')
    .eq('id', id)
    .eq('company_id', companyId)
    .single();

  if (prodErr) throw prodErr;
  const product = mapDbProduct(dbProd);

  // Fetch sales involving this product using actual snake_case columns
  const { data: dbItems, error: itemsErr } = await supabase
    .from('sale_items')
    .select('id, sale_id, quantity, unit_price, subtotal, sales(created_at, customers(full_name))')
    .eq('product_id', id)
    .order('id', { ascending: false });

  if (itemsErr) throw itemsErr;

  const history = (dbItems || []).map((item: any) => ({
    id: item.id,
    saleId: item.sale_id,
    date: item.sales?.created_at || new Date().toISOString(),
    quantity: Number(item.quantity),
    unitPrice: Number(item.unit_price),
    totalAmount: Number(item.subtotal),
    customerName: item.sales?.customers?.full_name || 'Consumidor Final',
  }));

  return { product, history };
};

/**
 * Fetch summarized analytics regarding current inventory levels
 */
export interface InventorySummaryStats {
  totalActiveProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalInventoryValue: number;
}

export const getInventoryStats = async (): Promise<InventorySummaryStats> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data, error } = await supabase
    .from('products')
    .select('current_quantity, min_quantity, cost_price, is_active')
    .eq('company_id', companyId);

  if (error) throw error;

  const activeProds = data?.filter(p => p.is_active) || [];
  const totalActiveProducts = activeProds.length;
  const lowStockProducts = activeProds.filter(p => Number(p.current_quantity) > 0 && Number(p.current_quantity) <= Number(p.min_quantity)).length;
  const outOfStockProducts = activeProds.filter(p => Number(p.current_quantity) === 0).length;
  const totalInventoryValue = activeProds.reduce((sum, p) => sum + (Number(p.current_quantity) * Number(p.cost_price || 0)), 0);

  return {
    totalActiveProducts,
    lowStockProducts,
    outOfStockProducts,
    totalInventoryValue
  };
};

/**
 * Create a new product record
 */
export const createProduct = async (
  data: Omit<Product, 'id' | 'companyId' | 'isActive' | 'createdAt' | 'category'>
): Promise<Product> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  const newId = crypto.randomUUID();

  const dbInsert = {
    id: newId,
    company_id: companyId,
    category_id: data.categoryId,
    name: data.name,
    description: data.description,
    sku: data.sku,
    barcode: data.barcode,
    unit: data.unit,
    cost_price: data.costPrice,
    sale_price: data.salePrice,
    current_quantity: data.currentQuantity,
    min_quantity: data.minQuantity,
    max_quantity: data.maxQuantity,
    is_active: true
  };

  const { data: dbProd, error } = await supabase
    .from('products')
    .insert(dbInsert)
    .select('*, categories(*)')
    .single();

  if (error) throw error;
  return mapDbProduct(dbProd);
};

/**
 * Update general product info
 */
export const updateProduct = async (
  id: string,
  data: Partial<Omit<Product, 'id' | 'companyId' | 'createdAt' | 'category'>>
): Promise<Product> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const dbPayload: any = {};
  if (data.categoryId !== undefined) dbPayload.category_id = data.categoryId;
  if (data.name !== undefined) dbPayload.name = data.name;
  if (data.description !== undefined) dbPayload.description = data.description;
  if (data.sku !== undefined) dbPayload.sku = data.sku;
  if (data.barcode !== undefined) dbPayload.barcode = data.barcode;
  if (data.unit !== undefined) dbPayload.unit = data.unit;
  if (data.costPrice !== undefined) dbPayload.cost_price = data.costPrice;
  if (data.salePrice !== undefined) dbPayload.sale_price = data.salePrice;
  if (data.currentQuantity !== undefined) dbPayload.current_quantity = data.currentQuantity;
  if (data.minQuantity !== undefined) dbPayload.min_quantity = data.minQuantity;
  if (data.maxQuantity !== undefined) dbPayload.max_quantity = data.maxQuantity;
  if (data.isActive !== undefined) dbPayload.is_active = data.isActive;

  const { data: dbProd, error } = await supabase
    .from('products')
    .update(dbPayload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*, categories(*)')
    .single();

  if (error) throw error;
  return mapDbProduct(dbProd);
};

/**
 * Adjust product quantity manually
 */
export const updateProductQuantity = async (
  id: string,
  quantity: number,
  operation: 'set' | 'add' | 'subtract'
): Promise<Product> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  // We first read the product to know the current stock
  const { data: prodData, error: readErr } = await supabase
    .from('products')
    .select('current_quantity')
    .eq('id', id)
    .eq('company_id', companyId)
    .single();

  if (readErr) throw readErr;

  let nextQty = quantity;
  if (operation === 'add') {
    nextQty = Number(prodData.current_quantity || 0) + quantity;
  } else if (operation === 'subtract') {
    nextQty = Math.max(0, Number(prodData.current_quantity || 0) - quantity);
  }

  const { data: dbProd, error } = await supabase
    .from('products')
    .update({ current_quantity: nextQty })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*, categories(*)')
    .single();

  if (error) throw error;
  return mapDbProduct(dbProd);
};

/**
 * Toggles a product active status
 */
export const toggleProductStatus = async (
  id: string,
  isActive: boolean
): Promise<Product> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  const { data: dbProd, error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*, categories(*)')
    .single();

  if (error) throw error;
  return mapDbProduct(dbProd);
};

/**
 * Custom robust CSV parsing and batch inserts
 */
export interface CSVImportResult {
  success: number;
  errors: string[];
}

export const importProductsCSV = async (file: File): Promise<CSVImportResult> => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) {
        resolve({ success: 0, errors: ['O arquivo selecionado está vazio ou ilegível.'] });
        return;
      }

      // Split lines, handle CR/LF
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        resolve({ success: 0, errors: ['O arquivo precisa conter um cabeçalho e pelo menos uma linha de dados.'] });
        return;
      }

      // Detect separator: comma vs semicolon
      const firstLine = lines[0];
      const separator = firstLine.includes(';') ? ';' : ',';

      // Parse headers
      const headers = firstLine.split(separator).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
      
      const successItems: any[] = [];
      const errors: string[] = [];

      // Maps file headers to expected columns
      const getIndex = (aliases: string[]) => {
        return headers.findIndex(h => aliases.some(alias => h.includes(alias)));
      };

      const nameIdx = getIndex(['nome', 'name', 'produto']);
      const descIdx = getIndex(['descricao', 'desc', 'description']);
      const skuIdx = getIndex(['sku', 'codigo']);
      const costIdx = getIndex(['custo', 'cost', 'preco_custo']);
      const saleIdx = getIndex(['venda', 'sale', 'preco_venda', 'preco']);
      const currentQtyIdx = getIndex(['quantidade_atual', 'atual', 'qtd', 'current', 'quantidade']);
      const minQtyIdx = getIndex(['quantidade_minima', 'minima', 'min', 'estoque_minimo']);
      const unitIdx = getIndex(['unidade', 'unit', 'un']);
      const categoryIdx = getIndex(['categoria', 'category', 'cat']);

      if (nameIdx === -1) {
        resolve({ success: 0, errors: ['Coluna "nome" é obrigatória e não foi localizada no cabeçalho do CSV.'] });
        return;
      }

      // Load existing categories to map names to IDs
      let categoriesList: Category[] = [];
      try {
        categoriesList = await getCategories();
      } catch (e) {
        resolve({ success: 0, errors: ['Não foi possível carregar as categorias para mapeamento.'] });
        return;
      }

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        let fields: string[] = [];
        let insideQuotes = false;
        let currentField = '';

        for (let charIdx = 0; charIdx < line.length; charIdx++) {
          const char = line[charIdx];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === separator && !insideQuotes) {
            fields.push(currentField.trim().replace(/^["']|["']$/g, ''));
            currentField = '';
          } else {
            currentField += char;
          }
        }
        fields.push(currentField.trim().replace(/^["']|["']$/g, ''));

        // Validate basic columns
        const name = fields[nameIdx];
        if (!name) {
          errors.push(`Linha ${i + 1}: O nome do produto é obrigatório.`);
          continue;
        }

        const sku = skuIdx !== -1 && fields[skuIdx] ? fields[skuIdx] : `SKU-CSV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const description = descIdx !== -1 ? fields[descIdx] : '';
        const unit = unitIdx !== -1 && fields[unitIdx] ? fields[unitIdx] : 'Unidade';

        // Math numbers parse
        const costPrice = costIdx !== -1 ? parseFloat(fields[costIdx].replace(',', '.')) : 0;
        const salePrice = saleIdx !== -1 ? parseFloat(fields[saleIdx].replace(',', '.')) : 0;
        const currentQuantity = currentQtyIdx !== -1 ? parseInt(fields[currentQtyIdx], 10) : 0;
        const minQuantity = minQtyIdx !== -1 ? parseInt(fields[minQtyIdx], 10) : 0;

        if (isNaN(costPrice) || costPrice < 0) {
          errors.push(`Linha ${i + 1} (${name}): Preço de custo inválido.`);
          continue;
        }
        if (isNaN(salePrice) || salePrice < 0) {
          errors.push(`Linha ${i + 1} (${name}): Preço de venda inválido.`);
          continue;
        }
        if (salePrice < costPrice) {
          errors.push(`Linha ${i + 1} (${name}): Preço de venda não pode ser inferior ao preço de custo.`);
          continue;
        }
        if (isNaN(currentQuantity) || currentQuantity < 0) {
          errors.push(`Linha ${i + 1} (${name}): Quantidade atual inválida.`);
          continue;
        }

        // Category mapping or inline creation
        let categoryName = categoryIdx !== -1 ? fields[categoryIdx] : 'Geral';
        if (!categoryName) categoryName = 'Geral';

        let category = categoriesList.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
        let catId = '';

        if (category) {
          catId = category.id;
        } else {
          try {
            const newCat = await createCategory(categoryName);
            categoriesList.push(newCat);
            catId = newCat.id;
          } catch (err) {
            resolve({ success: 0, errors: [`Linha ${i + 1} (${name}): Não foi possível criar a categoria "${categoryName}".`] });
            return;
          }
        }

        successItems.push({
          id: crypto.randomUUID(),
          company_id: companyId,
          category_id: catId,
          name,
          description,
          sku,
          barcode: '',
          unit,
          cost_price: costPrice,
          sale_price: salePrice,
          current_quantity: currentQuantity,
          min_quantity: minQuantity,
          max_quantity: currentQuantity * 2 > 10 ? currentQuantity * 2 : 10,
          is_active: true
        });
      }

      if (successItems.length === 0) {
        resolve({ success: 0, errors });
        return;
      }

      try {
        const { error } = await supabase
          .from('products')
          .insert(successItems);

        if (error) throw error;

        resolve({ success: successItems.length, errors });
      } catch (err: any) {
        resolve({ success: 0, errors: [...errors, `Erro na inserção do banco: ${err.message || err}`] });
      }
    };
    reader.onerror = () => {
      resolve({ success: 0, errors: ['Ocorreu um erro técnico ao ler o arquivo CSV.'] });
    };
    reader.readAsText(file);
  });
};
