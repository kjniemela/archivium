import { useState } from "react";
import { T } from "../helpers";


// TODO - all of this needs to be generalized! (And split into a non-react file so the backend can use it for SSR.)
function getYearValue(time: Time) {
  const { Year } = time;
  if (Year % 4 === 0 && (Year % 100 !== 0 || Year % 400 === 0)) return 316224000;
  else return 315360000;
}
function getMonthValue(time: Time) {
  const { Month } = time;
  if (Month === 2) return getYearValue(time) === 316224000 ? (29 * 864000) : (28 * 864000);
  else if (Month === 4 || Month === 6 || Month === 9 || Month === 11) return 30 * 864000;
  else return 31 * 864000;
}
function nameMonth(month: number): string {
  return {
    1: 'January',
    2: 'February',
    3: 'March',
    4: 'April',
    5: 'May',
    6: 'June',
    7: 'July',
    8: 'August',
    9: 'September',
    10: 'October',
    11: 'November',
    12: 'December',
  }[month] as string;
}
function nameDay(day: number): string {
  if (day % 10 === 1 && day % 100 !== 11) return `${day}st`;
  else if (day % 10 === 2 && day % 100 !== 12) return `${day}nd`;
  else if (day % 10 === 3 && day % 100 !== 13) return `${day}rd`;
  else return `${day}th`;
}

const defaults: Time = {
  Year: 0,
  Month: 1,
  Day: 1,
  Hour: 0,
  Minute: 0,
  Second: 0,
};

const evals: { [key: string]: (time: Time) => number } = {
  Year: getYearValue,
  Month: getMonthValue,
  Day: () => 864000,
  Hour: () => 36000,
  Minute: () => 600,
  Second: () => 10,
};

const names: { [key: string]: (v: number) => string } = {
  Year: v => v.toString(),
  Month: v => nameMonth(v),
  Day: v => nameDay(v),
  Hour: v => v.toString(),
  Minute: v => v.toString(),
  Second: v => v.toString(),
};

function computeTime(abstime: number): Time {
  let curTime = abstime;
  const time = { ...defaults };
  for (const key in time) {
    while (curTime >= evals[key](time)) {
      curTime -= evals[key](time);
      time[key] += 1;
    }
  }
  return time;
}

function computeAbsTime(time: Time): number {
  let abstime = 0;
  const _time = { ...time };
  for (const key in _time) {
    while (_time[key] > defaults[key]) {
      _time[key] -= 1;
      abstime += evals[key](_time);
    }
  }

  return abstime;
}

type Time = { [key: string]: number };

type TimePickerProps = {
  abstime: number,
  onSelect: (time: number) => void,
};

export default function TimePicker({ abstime, onSelect }: TimePickerProps) {
  const [time, setTime] = useState<Time>(computeTime(abstime));

  return <>
    {Object.keys(time).map((key) => (
      <div key={key}>
        <label>{T(key)}: </label>
        <input value={time[key]} onChange={({ target }) => {
          const newTime = { ...time };
          newTime[key] = Number(target.value);
          setTime(newTime);
        }} />
      </div>
    ))}
    <button type='button' onClick={() => onSelect(computeAbsTime(time))}>Select</button>
  </>;
}
