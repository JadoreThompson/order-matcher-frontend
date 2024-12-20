import { FC, useEffect, useState, useRef } from 'react';
import { ColorType, createChart, GridOptions, LayoutOptions, TimeScaleOptions } from 'lightweight-charts';
import { getCookie } from 'typescript-cookie';
import axios from 'axios';

// Local
import Alert from './Alert';
import { AlertTypes } from './Alert';
import DashboardLayout from './DashboardLayout';
import { OrderType, IntervalEnum, SocketMessageType, IntervalType } from '../types/Chart.types';


const Chart: FC = () => {
    let chart;

    const candlestickSeriesRef = useRef<any>();
    const [candlestickSeriesData, setCandlestickSeriesData] = useState<Array<Record<string, number | null>>>([]);
    const [currentInterval, setCurrentInterval] = useState<IntervalEnum>(IntervalEnum.M1);
    // const [currentIntervalSeconds, setCurrentIntervalSeconds] = useState<number>(IntervalType.toSeconds(IntervalEnum.M1));
    
    const currentIntervalSecondsRef = useRef<number>(IntervalType.toSeconds(IntervalEnum.M1));
    const candlestickSeriesDataRef = useRef<Array<Record<string, number>>>([]);
    const lastUpdateTimeRef = useRef<number | null>(null);


    /* --------------------
        Render chart
    -------------------- */
    const changeTimeFrame = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        document.querySelectorAll('.chart-card .btn-container .btn').forEach((button) => button.classList.remove('active'));
        const clickedButton = e.target as HTMLButtonElement;
        
        const newInterval = clickedButton.value as IntervalEnum;
        setCurrentInterval(newInterval);
        currentIntervalSecondsRef.current = IntervalType.toSeconds(newInterval);
        clickedButton.classList.add('active');
    };

    // useEffect(() => {
    //     setCurrentIntervalSeconds(IntervalType.toSeconds(currentInterval));
    // }, [currentInterval]);

    useEffect(() => {
        const fetchData = async () => {
            const { data } = await axios.get(`http://127.0.0.1:8000/instruments/?ticker=APPL&interval=${currentInterval}`, {
                headers: { 'Authorization': `Bearer ${getCookie('jwt')}` }
            });
            setCandlestickSeriesData(data);
            lastUpdateTimeRef.current = data[data.length - 1].time;
            candlestickSeriesDataRef.current = data;
        };
        fetchData();
    }, [currentInterval]);


    useEffect(() => {
        const renderChart = () => {
            try {
                const chartOptions: { autoSize: boolean, layout: LayoutOptions, grid: GridOptions, timeScale: TimeScaleOptions} = {
                    autoSize: true,
                    layout: {
                        background: {
                            type: ColorType.Solid,
                            color: getComputedStyle(document.documentElement).getPropertyValue('--dark-secondary-bg-color'),
                        },
                        textColor: getComputedStyle(document.documentElement).getPropertyValue('--dark-text-color'),
                        fontSize: 12,
                        fontFamily: getComputedStyle(document.documentElement).getPropertyValue("font-family"),
                        attributionLogo: false
                    },
                    grid: {
                        vertLines: { visible: false },
                        horzLines: { visible: false }
                    },
                    timeScale: {
                        timeVisible: true
                    }
                };

                const chartContainer = (document.getElementById('chart-container') as HTMLElement);
                chartContainer.innerHTML = '';
                chart = createChart(chartContainer!, chartOptions);
                candlestickSeriesRef.current = chart.addCandlestickSeries({ upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350' });
                candlestickSeriesRef.current.setData(candlestickSeriesData);
    
                chart.timeScale().fitContent();
            } catch(e) {
                console.error(e);
            }

        };

        renderChart();

    }, [candlestickSeriesData]);


    /* --------------------
            Websocket
    -------------------- */
    // useEffect(() => {
    //     const updateCandle = (newCandle: Record<string, number>) => {
    //         setcandlestickSeriesData((prevData) => {
                
    //         });
    //     };

    //     updateCandle();
    // }, [candlestickSeriesData]);
    

    const socketRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    
    const [alertType, setAlertType] = useState<AlertTypes | null>(null);
    const [alertMessage, setAlertMessage] = useState<string>('');
    const [alertCounter, setAlertCounter] = useState<number>(0);

    const addMessage = (message: string, messageType: string) => {
        if (Object.values(AlertTypes).includes(messageType)){
            setAlertMessage(message);
            setAlertType(messageType as AlertTypes);
            setAlertCounter(prev => prev + 1);
        }
    }; 

    const updateChartPrice = (newPrice: number, newTime: number) => {
        if (candlestickSeriesRef.current) {
            let lastCandle = candlestickSeriesDataRef.current[candlestickSeriesDataRef.current.length - 1];      
            let existingCandle: Record<string, number> | any = lastCandle;
            const timespan = Math.floor((newTime - lastUpdateTimeRef.current) / currentIntervalSecondsRef.current);

            if (timespan >= 1 && lastCandle) {
                const oldPrice = lastCandle.close;
                
                for (let i = 0; i < timespan; i++) {
                    lastUpdateTimeRef.current += currentIntervalSecondsRef.current;
                    const newCandle: Record<string, number | null> = {
                        time: lastUpdateTimeRef.current,
                        open: oldPrice,
                        high: oldPrice,
                        low: oldPrice,
                        close: oldPrice
                    };

                    candlestickSeriesData.push(newCandle);
                    candlestickSeriesRef.current.update(newCandle);
                    existingCandle = newCandle;
                }
            }

            let newCandle = existingCandle;
            newCandle.high = Math.max(existingCandle.high, newPrice);
            newCandle.low = Math.min(existingCandle.low, newPrice);
            newCandle.close = newPrice;
            candlestickSeriesRef.current.update(newCandle);
        }
    };

    useEffect(() => {
        /*
            Initialises and configures the functionality of the websocket
            object
        */

        // Updates the chart
        socketRef.current = new WebSocket("ws://127.0.0.1:8000/stream/trade");

        socketRef.current.onopen = () => {
            socketRef.current?.send(JSON.stringify({ token: getCookie('jwt') }));
            setIsConnected(true);
        };

        socketRef.current.onclose = (e) => {
            console.log(e.reason);
        };

        socketRef.current.onmessage = (e) => {
            const socketMessage = JSON.parse(e.data);
            
            if (Object.values(AlertTypes).includes(socketMessage.status)) {
                addMessage(socketMessage.message, socketMessage.status as AlertTypes);
            }

            // Routing
            if (socketMessage.status === SocketMessageType.PRICE){
                updateChartPrice(socketMessage.message.price, socketMessage.message.time);
            }
        };


        return () => {
            if (socketRef.current) { 
                socketRef.current.close(); 
            }
        };
    }, []);


    /* --------------------
            Handlers
    -------------------- */
    const [showOrderTypes, setShowOrderTypes] = useState<boolean>(false);
    const [showLimitOptions, setShowLimitOptions] = useState<boolean>(false);
    const [selectedOrderType, setSelectedOrderType] = useState<OrderType>(OrderType.MARKET_ORDER);


    const toggleOrderTypes = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setShowOrderTypes(true);
        (e.target as HTMLElement).classList.add('active');
    };

    const disableOrderTypes = () => {
        (document.getElementById('orderType') as HTMLElement).classList.remove('active');
        setShowOrderTypes(false);
    };

    const enableLimitOptions = (orderType: OrderType) => {
        setShowLimitOptions(true);
        disableOrderTypes();
    };

    const disableLimitOptions = (orderType: OrderType) => {
        setShowLimitOptions(false);
        disableOrderTypes();
    };

    const selectOrderType = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        const chosenOrderType = (e.target as HTMLButtonElement).value as OrderType;
        setSelectedOrderType(chosenOrderType);
        
        (document.getElementById('orderType') as HTMLElement).textContent = chosenOrderType.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        if (chosenOrderType == OrderType.LIMIT_ORDER){
            enableLimitOptions(chosenOrderType);
        } else {
            disableLimitOptions(chosenOrderType);
        }
    };


    const formSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        /*
            Sends form data over to the engine
        */

        e.preventDefault();

        let payload: Record<string, any> = {};

        const orderData = Object.fromEntries(
            Array.from(new FormData(e.target as HTMLFormElement).entries())
            .filter(([_, v]) => v !== '')
            .map(([k, v]) => {
                if (['quantity', 'limit_price'].includes(k)) { return [k, Number(v)]; }
                return [k, v];
            })
        );
        
        payload['type'] = selectedOrderType;
        payload[selectedOrderType] = orderData;
        
        if (isConnected && socketRef?.current) { 
            socketRef.current.send(JSON.stringify(payload)); 
            (e.target as HTMLFormElement).reset();
        }
    };


    /* --------------------
        Return Content
    -------------------- */
    return (
        <>
            <Alert message={alertMessage} type={alertType} counter={alertCounter}/>
            <DashboardLayout leftContent={
                <div className="chart-card card">
                    <div className="btn-container">
                      {Object.values(IntervalEnum).map((value) => (
                        <button key={value} className={`btn btn-secondary ${value === '1m' ? 'active': ''}`} value={value} onClick={changeTimeFrame}>{value}</button>
                      ))}
                    </div>
                    <div className="chart-container">
                        <div id="chart-container" className='chart'></div>
                    </div>
                    <div className="card-footer"></div>
                </div>

            } rightContent={
                <div className="card">
                    <form id='orderForm' onSubmit={formSubmit}>
                        <input type="text" name='ticker' placeholder='Ticker' value='APPL' pattern="[A-Za-z]+" readOnly/>
                        <input type="number" name='quantity' placeholder='Quantity'required/>
                        <button type='button' id='orderType' className="container" onClick={toggleOrderTypes}>Market Order</button>
                        <div className="options-container container" style={{display: showOrderTypes ? 'block': 'none'}}>
                            <div className="option">
                                <button onClick={selectOrderType} type="button"  value={OrderType.MARKET_ORDER}>Market Order</button>
                            </div>
                            <div className="option">
                                <button onClick={selectOrderType} type="button" value={OrderType.LIMIT_ORDER}>Limit Order</button>
                            </div>
                            <div className="option">
                                <button onClick={selectOrderType} type="button" value={OrderType.CLOSE_ORDER}>Close Order</button>
                            </div>
                        </div>
                        <div className="container limit-options" style={{display: showLimitOptions ? 'block': 'none'}}>
                            <input type="number" name='limit_price' placeholder='Limit Price' required={showLimitOptions}/>
                        </div>
                        <button type='submit' className='btn btn-primary'>Open Order</button>
                    </form>
                </div>
            }/>
        </>
    );
};

export default Chart;