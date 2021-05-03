import { useState, useRef, useEffect } from 'react';
import { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import Link from 'next/link';
import addDays from 'date-fns/addDays';
import subDays from 'date-fns/subDays';
import isAfter from 'date-fns/isAfter';
import Chart from 'components/Chart';
import ChartToolbar from 'components/ChartToolbar';
import SocialTags from 'components/SocialTags';
import { getIDs, getMetadata } from 'data/adapters';
import { getDateRangeData } from 'data/queries';
import { formatDate } from 'data/lib/time';

function getMissing(data: any, minDate: Date, maxDate: Date, id: string) {
  const missing = [];
  if (!data[id]) {
    data[id] = {};
  }

  for (let date = minDate; !isAfter(date, maxDate); date = addDays(date, 1)) {
    const dateStr = formatDate(date);
    if (!data[id][dateStr]) {
      missing.push(dateStr);
    }
  }
  return missing;
}

function getDateWithSmoothing(data: any, id: string, date: Date, smoothing: number) {
  let fee = data[id][formatDate(date)].fee;

  if (smoothing > 0) {
    for (let i = 1; i <= smoothing; i += 1) {
      fee += data[id][formatDate(subDays(date, i))].fee;
    }
    fee /= smoothing + 1;
  }

  return fee;
}

function formatData(
  data: any,
  minDate: Date,
  maxDate: Date,
  primaryId: string,
  secondaryId: string | null,
  smoothing: number
) {
  const result = [];
  for (let date = minDate; !isAfter(date, maxDate); date = addDays(date, 1)) {
    const primary = getDateWithSmoothing(data, primaryId, date, smoothing);
    const secondary = secondaryId ? getDateWithSmoothing(data, secondaryId, date, smoothing) : 0;

    result.push({
      date: date.getTime() / 1000,
      primary,
      secondary,
    });
  }
  return result;
}

function saveFeeData(response: any, storedFees: any) {
  for (const protocol of response) {
    if (!storedFees[protocol.id]) {
      storedFees[protocol.id] = {};
    }

    for (const { date, ...data } of protocol.data) {
      storedFees[protocol.id][date] = data;
    }
  }
}

const useFees = (
  initial: any,
  dateRange: { start: Date; end: Date },
  primary: string,
  secondary: string | null,
  smoothing: number
) => {
  const fees = useRef(initial);

  const [value, setValue] = useState({
    loading: false,
    data: [],
  });

  useEffect(() => {
    // We need to fetch extra data if using smoothing
    const actualStartDate = smoothing > 0 ? subDays(dateRange.start, smoothing) : dateRange.start;

    const missingPrimary = getMissing(fees.current, actualStartDate, dateRange.end, primary);
    const missingSecondary = secondary
      ? getMissing(fees.current, actualStartDate, dateRange.end, secondary)
      : [];

    if (missingPrimary.length > 0 || missingSecondary.length > 0) {
      setValue(({ data }) => ({ data, loading: true }));

      const secondaryQuery =
        missingSecondary.length > 0 ? `&${secondary}=${missingSecondary.join(',')}` : '';
      fetch(`/api/v1/feesByDay?${primary}=${missingPrimary.join(',')}&${secondaryQuery}`)
        .then((response: any) => response.json())
        .then((response: any) => {
          if (!response.success) {
            console.error(response);
            setValue(({ data }) => ({ data, loading: false }));
            return;
          }

          saveFeeData(response.data, fees.current);

          setValue({
            loading: false,
            data: formatData(
              fees.current,
              dateRange.start,
              dateRange.end,
              primary,
              secondary,
              smoothing
            ),
          });
        });
    } else {
      setValue({
        loading: false,
        data: formatData(
          fees.current,
          dateRange.start,
          dateRange.end,
          primary,
          secondary,
          smoothing
        ),
      });
    }
  }, [dateRange, primary, secondary, smoothing]);

  return value;
};

interface ProtocolDetailsProps {
  id: string;
  metadata: any;
  feeCache: any;
  protocols: { [id: string]: string };
}

const dateFloor = (date: Date) => {
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

export const ProtocolDetails: NextPage<ProtocolDetailsProps> = ({
  id,
  metadata,
  feeCache,
  protocols,
}) => {
  const [dateRange, setDateRange] = useState({
    start: dateFloor(subDays(new Date(), 90)),
    end: dateFloor(subDays(new Date(), 1)),
  });
  const [smoothing, setSmoothing] = useState(0);
  const [secondary, setSecondary] = useState<string | null>(null);

  const { loading, data } = useFees(feeCache, dateRange, id, secondary, smoothing);

  const { [id]: filter, ...otherProtocols } = protocols; // eslint-disable-line @typescript-eslint/no-unused-vars

  return (
    <main>
      <SocialTags title={metadata.name} image={id} />

      <h1 className="title">CryptoFees.info</h1>
      <div>
        <Link href="/">
          <a>Back to list</a>
        </Link>
      </div>

      <h2 className="subtitle">{metadata.name}</h2>

      <ChartToolbar
        range={dateRange}
        onRangeChange={setDateRange}
        maxDate={subDays(new Date(), 1)}
        smoothing={smoothing}
        onSmoothingChange={setSmoothing}
        protocols={otherProtocols}
        secondary={secondary}
        onSecondaryChange={setSecondary}
      />

      <div className="chart-container">
        <Chart
          data={data}
          loading={loading}
          primary={id}
          secondary={secondary}
          protocols={protocols}
        />
      </div>

      <p>{metadata.description}</p>
      <p>{metadata.feeDescription}</p>

      <style jsx>{`
        .title {
          margin: 10px 0 4px;
        }
        .chart-container {
          padding: 14px;
          background: #ffffff;
          border-radius: 8px;
          margin: 6px 0;
          border: solid 1px #d0d1d9;
        }
      `}</style>
    </main>
  );
};

export default ProtocolDetails;

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const id = params.id.toString();
  const defaultFeesArray = await getDateRangeData(
    id,
    subDays(new Date(), 90),
    subDays(new Date(), 1)
  );
  const defaultFees: { [date: string]: any } = {};
  for (const { date, ...data } of defaultFeesArray) {
    defaultFees[date] = data;
  }

  const ids = getIDs().sort();
  const protocols: { [id: string]: string } = {};
  for (const id of ids) {
    protocols[id] = getMetadata(id).name;
  }

  return {
    props: {
      id,
      metadata: getMetadata(id),
      feeCache: {
        [id]: defaultFees,
      },
      protocols,
    },
    revalidate: 60,
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: getIDs().map((id: string) => ({ params: { id } })),
    fallback: false,
  };
};
