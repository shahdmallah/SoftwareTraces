import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useLanguage } from '../contexts/LanguageContext';
import {
  getWeatherVisual,
  formatTemperature,
  formatPercent,
  formatWind,
  formatDisplayTime,
  formatShortDayDate,
  getDayTemperatureRange,
} from '../utils/weatherUtils';
import { buildSmoothPath } from '../utils/trailUtils';
import type { ForecastDay, HourlyWeatherHour } from '../api/trailsApi';

interface WeatherSectionProps {
  weeklyForecast: ForecastDay[];
  selectedForecastDate: string | null;
  onSelectForecastDate: (date: string) => void;
  isWeatherLoading: boolean;
  weatherError: string | null;
  trail: any;
}

export function WeatherSection({
  weeklyForecast,
  selectedForecastDate,
  onSelectForecastDate,
  isWeatherLoading,
  weatherError,
  trail,
}: WeatherSectionProps) {
  const { language, t } = useLanguage();
  const isArabic = language === 'ar';

  const hourlyLabel = isArabic ? 'كل ساعة' : 'Hourly';
  const feelsLikeLabel = isArabic ? 'المحسوسة' : 'Feels like';
  const precipLabel = isArabic ? 'احتمال المطر' : 'Precip';
  const windLabel = isArabic ? 'الرياح' : 'Wind';
  const noWeatherLabel = isArabic ? 'لا توجد بيانات طقس متاحة الآن.' : 'No weather data is available right now.';

  const selectedForecast = weeklyForecast.find((day) => day.date === selectedForecastDate) ?? weeklyForecast[0] ?? null;
  const selectedForecastHours = selectedForecast?.hours ?? [];
  const heroHour = selectedForecastHours[0] ?? null;

  const selectedRange = getDayTemperatureRange(selectedForecastHours);
  const chartTemperatures = selectedForecastHours
    .map((hour) => hour.temperatureC)
    .filter((value): value is number => value != null);
  const minChartTemp = chartTemperatures.length ? Math.min(...chartTemperatures) : 0;
  const maxChartTemp = chartTemperatures.length ? Math.max(...chartTemperatures) : 0;
  const chartHours = selectedForecastHours.slice(0, 8);
  const chartAxisWidth = 42;
  const chartWidth = 248;
  const chartHeight = 172;
  const chartPaddingLeft = 18;
  const chartPaddingRight = 18;
  const chartPaddingTop = 18;
  const chartPaddingBottom = 34;
  const chartPlotHeight = chartHeight - chartPaddingTop - chartPaddingBottom;
  const chartPlotWidth = chartWidth - chartPaddingLeft - chartPaddingRight;
  const chartRange = Math.max(1, maxChartTemp - minChartTemp);
  const chartTicks = [maxChartTemp, minChartTemp + chartRange / 2, minChartTemp].map((value, index, collection) => ({
    value,
    y: chartPaddingTop + (index / Math.max(1, collection.length - 1)) * chartPlotHeight,
  }));
  const chartPoints = chartHours.map((hour, index) => {
    const x =
      chartHours.length <= 1
        ? chartPaddingLeft + chartPlotWidth / 2
        : chartPaddingLeft + (index / (chartHours.length - 1)) * chartPlotWidth;
    const temperature = hour.temperatureC ?? minChartTemp;
    const normalized = (temperature - minChartTemp) / chartRange;
    const y = chartPaddingTop + (1 - normalized) * chartPlotHeight;

    return { x, y, hour, index };
  });
  const chartLinePath = buildSmoothPath(chartPoints);
  const chartAreaPath = chartPoints.length
    ? `${chartLinePath} L ${chartPoints[chartPoints.length - 1].x} ${chartHeight - chartPaddingBottom} L ${chartPoints[0].x} ${chartHeight - chartPaddingBottom} Z`
    : '';

  if (isWeatherLoading) {
    return (
      <View style={styles.weatherCard}>
        <View style={styles.weatherLoading}>
          <ActivityIndicator color="#630E13" />
        </View>
      </View>
    );
  }

  if (!selectedForecast) {
    return (
      <View style={styles.weatherCard}>
        <View style={styles.noWeatherState}>
          <Ionicons name="cloud-offline-outline" size={22} color="#8A7A6A" />
          <Text style={styles.noWeatherText}>{weatherError ?? noWeatherLabel}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.weatherCard}>
      <View style={styles.weatherHeaderRow}>
        <Text style={styles.weatherTitle}>Weather</Text>
      </View>

      <View style={styles.weatherTopSection}>
        <GestureScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.forecastStripContent}
          scrollEventThrottle={16}
        >
          {weeklyForecast.map((day) => {
            const visual = getWeatherVisual(day.summary, day.hours[0]?.isDaytime);
            const isSelected = day.date === selectedForecast.date;

            return (
              <Pressable
                key={`${day.date}-${day.dayLabel}`}
                onPress={() => onSelectForecastDate(day.date)}
                style={({ pressed }) => [
                  styles.dailyForecastItem,
                  isSelected && styles.dailyForecastItemActive,
                  pressed && styles.forecastPillPressed,
                ]}
              >
                <Text style={[styles.dailyForecastDay, isSelected && styles.dailyForecastDayActive]}>
                  {formatShortDayDate(day.date, language)}
                </Text>
                <Text style={styles.dailyForecastIcon}>{visual.emoji}</Text>
              </Pressable>
            );
          })}
        </GestureScrollView>
      </View>

      <View style={styles.weatherHeroCenter}>
        <View style={styles.weatherConditionRow}>
          <Text style={styles.weatherConditionEmoji}>
            {getWeatherVisual(selectedForecast.summary, heroHour?.isDaytime).emoji}
          </Text>
          <Text style={styles.weatherHeroSummary}>{selectedForecast.summary}</Text>
        </View>
        <View style={styles.weatherTempRow}>
          <Text style={styles.weatherHeroTemp}>{formatTemperature(selectedRange.high)}</Text>
          <Text style={styles.weatherHeroTempMuted}>{formatTemperature(selectedRange.low)}</Text>
        </View>
        <Text style={styles.weatherUpdated}>
          {trail.region} | {formatDisplayTime(heroHour?.timestamp ?? new Date().toISOString(), language)}
        </Text>
      </View>

      <View style={styles.weatherMetaRow}>
        <View style={styles.weatherMetaItem}>
          <Ionicons name="rainy-outline" size={18} color="#2C2418" />
          <Text style={styles.weatherMetaValue}>{formatPercent(heroHour?.precipitationProbability ?? null)}</Text>
        </View>
        <View style={styles.weatherMetaItem}>
          <Ionicons name="sunny-outline" size={18} color="#2C2418" />
          <Text style={styles.weatherMetaValue}>
            {formatDisplayTime(selectedForecastHours[0]?.timestamp ?? new Date().toISOString(), language)}
          </Text>
        </View>
        <View style={styles.weatherMetaItem}>
          <Ionicons name="partly-sunny-outline" size={18} color="#2C2418" />
          <Text style={styles.weatherMetaValue}>
            {formatDisplayTime(selectedForecastHours[selectedForecastHours.length - 1]?.timestamp ?? new Date().toISOString(), language)}
          </Text>
        </View>
      </View>

      {weatherError ? <Text style={styles.weatherErrorInline}>{weatherError}</Text> : null}

      <View style={styles.weatherChartCard}>
        <View style={styles.chartMetricsRow}>
          <View style={styles.chartMetric}>
            <Text style={styles.chartMetricLabel}>{feelsLikeLabel}</Text>
            <Text style={styles.chartMetricValue}>{formatTemperature(heroHour?.feelsLikeC ?? null)}</Text>
          </View>
          <View style={styles.chartMetric}>
            <Text style={styles.chartMetricLabel}>{precipLabel}</Text>
            <Text style={styles.chartMetricValue}>{formatPercent(heroHour?.precipitationProbability ?? null)}</Text>
          </View>
          <View style={styles.chartMetric}>
            <Text style={styles.chartMetricLabel}>{windLabel}</Text>
            <Text style={styles.chartMetricValue}>{formatWind(heroHour?.windSpeedKph ?? null)}</Text>
          </View>
        </View>

        <View style={styles.hourlyHeader}>
          <Text style={styles.hourlyTitle}>{hourlyLabel}</Text>
          <Text style={styles.hourlySubtitle}>{selectedForecastHours.length} {isArabic ? 'ساعة' : 'hours'}</Text>
        </View>

        <View style={styles.chartArea}>
          <View style={styles.chartPlotRow}>
            <View style={[styles.chartAxis, { width: chartAxisWidth, height: chartHeight }]}>
              {chartTicks.map((tick) => (
                <Text key={`tick-${tick.y}`} style={[styles.chartAxisLabel, { top: tick.y - 8 }]}>
                  {formatTemperature(tick.value)}
                </Text>
              ))}
            </View>
            <View>
              <Svg width={chartWidth} height={chartHeight} style={styles.chartSvg}>
                {chartTicks.map((tick) => (
                  <Line
                    key={`grid-${tick.y}`}
                    x1={chartPaddingLeft}
                    y1={tick.y}
                    x2={chartWidth - chartPaddingRight}
                    y2={tick.y}
                    stroke="rgba(99,14,19,0.10)"
                    strokeDasharray="4 6"
                    strokeWidth={1}
                  />
                ))}
                {chartAreaPath ? <Path d={chartAreaPath} fill="rgba(185,141,61,0.18)" /> : null}
                {chartLinePath ? (
                  <Path
                    d={chartLinePath}
                    fill="none"
                    stroke="#8F5B2E"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                {chartPoints.map((point) => (
                  <React.Fragment key={point.hour.timestamp || `${point.hour.localTime}-${point.index}`}>
                    <Line
                      x1={point.x}
                      y1={point.y + 10}
                      x2={point.x}
                      y2={chartHeight - chartPaddingBottom + 2}
                      stroke="rgba(99,14,19,0.10)"
                      strokeWidth={1}
                    />
                    {point.index === 0 ? (
                      <Circle cx={point.x} cy={point.y} r={10} fill="rgba(99,14,19,0.10)" />
                    ) : null}
                    <Circle
                      cx={point.x}
                      cy={point.y}
                      r={point.index === 0 ? 6 : 4.5}
                      fill={point.index === 0 ? '#630E13' : '#B98D3D'}
                    />
                  </React.Fragment>
                ))}
              </Svg>
              <View style={styles.chartLabelsRow}>
                {chartPoints.map((point) => (
                  <View key={`label-${point.hour.timestamp}`} style={styles.chartLabelColumn}>
                    <Text style={styles.chartTimeLabel}>
                      {formatDisplayTime(point.hour.timestamp, language)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weatherCard: {
    backgroundColor: '#fcfcfc',
    padding: 20,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(44,36,24,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  weatherHeaderRow: {
    marginBottom: 20,
  },
  weatherTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1F211A',
    letterSpacing: -0.8,
  },
  weatherTopSection: {
    marginBottom: 24,
  },
  weatherHeroCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  weatherConditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  weatherConditionEmoji: {
    fontSize: 22,
  },
  weatherUpdated: {
    marginTop: 6,
    fontSize: 12,
    color: '#7B6A58',
    textAlign: 'center',
  },
  weatherTempRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  weatherHeroTemp: {
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '900',
    color: '#2C2418',
  },
  weatherHeroTempMuted: {
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '800',
    color: '#C6C1B4',
  },
  weatherHeroSummary: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2C2418',
    textAlign: 'center',
  },
  weatherMetaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginBottom: 6,
  },
  weatherMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherMetaValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2C2418',
  },
  weatherErrorInline: {
    marginTop: 10,
    fontSize: 12,
    color: '#9A3E38',
    fontWeight: '700',
    textAlign: 'center',
  },
  weatherLoading: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noWeatherState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  noWeatherText: {
    fontSize: 13,
    color: '#6B5D4E',
    lineHeight: 20,
  },
  forecastStripContent: {
    flexDirection: 'row',
    paddingRight: 8,
  },
  dailyForecastItem: {
    width: 76,
    flexShrink: 0,
    marginRight: 10,
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyForecastItemActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1F211A',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  forecastPillPressed: {
    transform: [{ scale: 0.97 }],
  },
  dailyForecastDay: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B5D4E',
  },
  dailyForecastDayActive: {
    color: '#2C2418',
  },
  dailyForecastIcon: {
    marginTop: 10,
    fontSize: 28,
  },
  weatherChartCard: {
    marginTop: 18,
  },
  chartMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  chartMetric: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.05)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  chartMetricLabel: {
    fontSize: 11,
    color: '#8A7A6A',
    fontWeight: '700',
    textAlign: 'center',
  },
  chartMetricValue: {
    marginTop: 4,
    fontSize: 14,
    color: '#2C2418',
    fontWeight: '900',
    textAlign: 'center',
  },
  hourlyHeader: {
    marginTop: 6,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hourlyTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2C2418',
    textAlign: 'center',
  },
  hourlySubtitle: {
    fontSize: 12,
    color: '#8A7A6A',
    fontWeight: '700',
    textAlign: 'center',
  },
  chartArea: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.08)',
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  chartPlotRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  chartAxis: {
    position: 'relative',
    marginRight: 4,
  },
  chartAxisLabel: {
    position: 'absolute',
    right: 6,
    fontSize: 11,
    color: '#6C3922',
    fontWeight: '800',
    textAlign: 'right',
  },
  chartSvg: {
    alignSelf: 'center',
  },
  chartLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
    paddingHorizontal: 18,
  },
  chartLabelColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chartTimeLabel: {
    marginTop: 6,
    fontSize: 11,
    color: '#8A7A6A',
    fontWeight: '700',
    textAlign: 'center',
  },
});