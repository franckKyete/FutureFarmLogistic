import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrencyEntity } from './entities/currency.entity';
import {
  CountryCurrencyConfigDto,
  CurrencyDto,
  LiveExchangeRatesDto,
  UpdateCurrencyRateDto,
} from '@futurefarm/types';

export const SUPPORTED_COUNTRIES: CountryCurrencyConfigDto[] = [
  {
    countryCode: 'COD',
    countryName: 'RDC (Congo-Kinshasa)',
    defaultCurrency: 'CDF',
    supportedCurrencies: ['CDF', 'USD'],
    flagEmoji: '🇨🇩',
  },
  {
    countryCode: 'SEN',
    countryName: 'Sénégal',
    defaultCurrency: 'XOF',
    supportedCurrencies: ['XOF'],
    flagEmoji: '🇸🇳',
  },
  {
    countryCode: 'CIV',
    countryName: "Côte d'Ivoire",
    defaultCurrency: 'XOF',
    supportedCurrencies: ['XOF'],
    flagEmoji: '🇨🇮',
  },
  {
    countryCode: 'BEN',
    countryName: 'Bénin',
    defaultCurrency: 'XOF',
    supportedCurrencies: ['XOF'],
    flagEmoji: '🇧🇯',
  },
  {
    countryCode: 'BFA',
    countryName: 'Burkina Faso',
    defaultCurrency: 'XOF',
    supportedCurrencies: ['XOF'],
    flagEmoji: '🇧🇫',
  },
  {
    countryCode: 'CMR',
    countryName: 'Cameroun',
    defaultCurrency: 'XAF',
    supportedCurrencies: ['XAF'],
    flagEmoji: '🇨🇲',
  },
  {
    countryCode: 'COG',
    countryName: 'Congo-Brazzaville',
    defaultCurrency: 'XAF',
    supportedCurrencies: ['XAF'],
    flagEmoji: '🇨🇬',
  },
  {
    countryCode: 'GAB',
    countryName: 'Gabon',
    defaultCurrency: 'XAF',
    supportedCurrencies: ['XAF'],
    flagEmoji: '🇬🇦',
  },
  {
    countryCode: 'GHA',
    countryName: 'Ghana',
    defaultCurrency: 'GHS',
    supportedCurrencies: ['GHS'],
    flagEmoji: '🇬🇭',
  },
  {
    countryCode: 'KEN',
    countryName: 'Kenya',
    defaultCurrency: 'KES',
    supportedCurrencies: ['KES'],
    flagEmoji: '🇰🇪',
  },
  {
    countryCode: 'RWA',
    countryName: 'Rwanda',
    defaultCurrency: 'RWF',
    supportedCurrencies: ['RWF'],
    flagEmoji: '🇷🇼',
  },
  {
    countryCode: 'UGA',
    countryName: 'Ouganda',
    defaultCurrency: 'UGX',
    supportedCurrencies: ['UGX'],
    flagEmoji: '🇺🇬',
  },
  {
    countryCode: 'ZMB',
    countryName: 'Zambie',
    defaultCurrency: 'ZMW',
    supportedCurrencies: ['ZMW'],
    flagEmoji: '🇿🇲',
  },
  {
    countryCode: 'NGA',
    countryName: 'Nigeria',
    defaultCurrency: 'NGN',
    supportedCurrencies: ['NGN'],
    flagEmoji: '🇳🇬',
  },
  {
    countryCode: 'USA',
    countryName: 'États-Unis',
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD'],
    flagEmoji: '🇺🇸',
  },
  {
    countryCode: 'FRA',
    countryName: 'France',
    defaultCurrency: 'EUR',
    supportedCurrencies: ['EUR'],
    flagEmoji: '🇫🇷',
  },
  {
    countryCode: 'GBR',
    countryName: 'Royaume-Uni',
    defaultCurrency: 'GBP',
    supportedCurrencies: ['GBP'],
    flagEmoji: '🇬🇧',
  },
];

export const INITIAL_CURRENCIES: Partial<CurrencyEntity>[] = [
  { code: 'USD', name: 'Dollar américain', symbol: '$', rateAgainstBase: 1.0, isBase: true, isActive: true },
  { code: 'CDF', name: 'Franc congolais', symbol: 'FC', rateAgainstBase: 2300.0, isBase: false, isActive: true },
  { code: 'XOF', name: 'Franc CFA (UEMOA)', symbol: 'FCFA', rateAgainstBase: 565.0, isBase: false, isActive: true },
  { code: 'XAF', name: 'Franc CFA (CEMAC)', symbol: 'FCFA', rateAgainstBase: 565.0, isBase: false, isActive: true },
  { code: 'EUR', name: 'Euro', symbol: '€', rateAgainstBase: 0.86, isBase: false, isActive: true },
  { code: 'KES', name: 'Shilling kényan', symbol: 'KSh', rateAgainstBase: 130.0, isBase: false, isActive: true },
  { code: 'RWF', name: 'Franc rwandais', symbol: 'FRw', rateAgainstBase: 1400.0, isBase: false, isActive: true },
  { code: 'UGX', name: 'Shilling ougandais', symbol: 'USh', rateAgainstBase: 3700.0, isBase: false, isActive: true },
  { code: 'GHS', name: 'Cedi ghanéen', symbol: 'GH₵', rateAgainstBase: 15.0, isBase: false, isActive: true },
  { code: 'ZMW', name: 'Kwacha zambien', symbol: 'ZK', rateAgainstBase: 28.0, isBase: false, isActive: true },
  { code: 'NGN', name: 'Naira nigérian', symbol: '₦', rateAgainstBase: 1500.0, isBase: false, isActive: true },
  { code: 'GBP', name: 'Livre sterling', symbol: '£', rateAgainstBase: 0.74, isBase: false, isActive: true },
];

@Injectable()
export class CurrenciesService implements OnModuleInit {
  private readonly logger = new Logger(CurrenciesService.name);

  constructor(
    @InjectRepository(CurrencyEntity)
    private readonly currencyRepo: Repository<CurrencyEntity>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultCurrencies();
  }

  private async seedDefaultCurrencies() {
    try {
      const count = await this.currencyRepo.count();
      if (count === 0) {
        this.logger.log('Seeding initial currencies and exchange rates...');
        for (const cur of INITIAL_CURRENCIES) {
          const entity = this.currencyRepo.create(cur);
          await this.currencyRepo.save(entity);
        }
        this.logger.log(`Seeded ${INITIAL_CURRENCIES.length} currencies.`);
      }
    } catch (err) {
      this.logger.error('Failed to seed default currencies', err);
    }
  }

  async getAllActive(): Promise<CurrencyDto[]> {
    const currencies = await this.currencyRepo.find({
      where: { isActive: true },
      order: { isBase: 'DESC', code: 'ASC' },
    });
    return currencies.map(this.toDto);
  }

  async getAllForAdmin(): Promise<CurrencyDto[]> {
    const currencies = await this.currencyRepo.find({
      order: { isBase: 'DESC', code: 'ASC' },
    });
    return currencies.map(this.toDto);
  }

  getCountryConfigs(): CountryCurrencyConfigDto[] {
    return SUPPORTED_COUNTRIES;
  }

  getCountryConfig(countryCode: string): CountryCurrencyConfigDto {
    const normalized = countryCode?.toUpperCase();
    const config = SUPPORTED_COUNTRIES.find((c) => c.countryCode === normalized);
    if (!config) {
      // Fallback
      return {
        countryCode: normalized || 'COD',
        countryName: 'Democratic Republic of Congo',
        defaultCurrency: 'CDF',
        supportedCurrencies: ['CDF', 'USD'],
        flagEmoji: '🇨🇩',
      };
    }
    return config;
  }

  async getLiveRates(): Promise<LiveExchangeRatesDto> {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!response.ok) {
        throw new Error(`External API returned status ${response.status}`);
      }
      const data = (await response.json()) as any;
      return {
        base: data.base_code || 'USD',
        date: data.time_last_update_utc || new Date().toISOString(),
        rates: data.rates || {},
      };
    } catch (err: any) {
      this.logger.error(`Error fetching live rates: ${err.message}`);
      throw new BadRequestException(`Could not fetch live exchange rates: ${err.message}`);
    }
  }

  async updateRate(code: string, dto: UpdateCurrencyRateDto): Promise<CurrencyDto> {
    const currency = await this.currencyRepo.findOne({
      where: { code: code.toUpperCase() },
    });
    if (!currency) {
      throw new NotFoundException(`Currency ${code} not found`);
    }

    if (currency.isBase && dto.rateAgainstBase !== undefined && dto.rateAgainstBase !== 1.0) {
      throw new BadRequestException('The base currency rate must always remain 1.0');
    }

    if (dto.rateAgainstBase !== undefined) {
      if (dto.rateAgainstBase <= 0) {
        throw new BadRequestException('Exchange rate must be strictly greater than 0');
      }
      currency.rateAgainstBase = dto.rateAgainstBase;
    }

    if (dto.isActive !== undefined) {
      if (currency.isBase && !dto.isActive) {
        throw new BadRequestException('The base currency cannot be deactivated');
      }
      currency.isActive = dto.isActive;
    }

    const saved = await this.currencyRepo.save(currency);
    return this.toDto(saved);
  }

  async syncLiveRates(): Promise<{ updated: string[]; rates: Record<string, number> }> {
    const live = await this.getLiveRates();
    const all = await this.currencyRepo.find();
    const updated: string[] = [];

    for (const cur of all) {
      if (cur.isBase) continue;
      const liveRate = live.rates[cur.code];
      if (liveRate && liveRate > 0) {
        cur.rateAgainstBase = liveRate;
        await this.currencyRepo.save(cur);
        updated.push(cur.code);
      }
    }

    return { updated, rates: live.rates };
  }

  async getRateSnapshot(currencyCode: string): Promise<{ currency: string; exchangeRate: number }> {
    const normalized = (currencyCode || 'USD').toUpperCase();
    const currency = await this.currencyRepo.findOne({
      where: { code: normalized, isActive: true },
    });

    if (!currency) {
      return { currency: 'USD', exchangeRate: 1.0 };
    }

    return {
      currency: currency.code,
      exchangeRate: Number(currency.rateAgainstBase),
    };
  }

  private toDto(entity: CurrencyEntity): CurrencyDto {
    return {
      code: entity.code,
      name: entity.name,
      symbol: entity.symbol,
      rateAgainstBase: Number(entity.rateAgainstBase),
      isActive: entity.isActive,
      isBase: entity.isBase,
      updatedAt: entity.updatedAt ? entity.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
