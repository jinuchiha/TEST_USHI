import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  convertCurrency,
  getSupportedCurrencies,
  RATES_TO_AED,
  formatCurrencyAmount,
} from './engines/currency.engine';

@ApiTags('Currency')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/currency')
export class AiCurrencyController {
  @Get('convert')
  @ApiOperation({ summary: 'Convert amount between currencies' })
  convert(
    @Query('amount') amount: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const converted = convertCurrency(parseFloat(amount), from, to);
    return {
      data: {
        original: { amount: parseFloat(amount), currency: from },
        converted: { amount: Math.round(converted * 100) / 100, currency: to },
        formatted: formatCurrencyAmount(converted, to),
        rate: converted / parseFloat(amount),
      },
    };
  }

  @Get('rates')
  @ApiOperation({ summary: 'Get all exchange rates (base: AED)' })
  getRates() {
    return { data: { base: 'AED', rates: RATES_TO_AED } };
  }

  @Get('supported')
  @ApiOperation({ summary: 'Get list of supported currencies' })
  getSupported() {
    return { data: getSupportedCurrencies() };
  }
}
