import axios from "axios";
import {
  ColorType,
  GridOptions,
  LayoutOptions,
  TimeScaleOptions,
  createChart,
} from "lightweight-charts";
import { FC, useEffect, useRef, useState } from "react";
import { getCookie } from "typescript-cookie";

// Local
import Alert, { AlertTypes } from "../components/Alert";
import DashboardLayout from "../components/DashboardLayout";
import DOM from "../components/DOM";
import OrderTable from "../components/OrdersTable";
import Sidebar from "../components/Sidebar";
import {
  IntervalEnum,
  IntervalType,
  OrderType,
  SocketMessageCategory,
} from "../types/TradingPageTypes";

const Trade: FC = () => {
  let chart;

  const candlestickSeriesRef = useRef<any>();
  const [candlestickSeriesData, setCandlestickSeriesData] = useState<
    Array<Record<string, number | null>>
  >([]);
  const [currentInterval, setCurrentInterval] = useState<IntervalEnum>(
    IntervalEnum.M1
  );

  const currentIntervalSecondsRef = useRef<number>(
    IntervalType.toSeconds(IntervalEnum.M1)
  );
  const candlestickSeriesDataRef = useRef<Array<Record<string, number>>>([]);
  const lastUpdateTimeRef = useRef<number | null>(null);

  /* --------------------
        Render chart
    -------------------- */
  const changeTimeFrame = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    document
      .querySelectorAll(".chart-card .btn-container .btn")
      .forEach((button) => button.classList.remove("active"));
    const clickedButton = e.target as HTMLButtonElement;

    const newInterval = clickedButton.value as IntervalEnum;
    setCurrentInterval(newInterval);
    currentIntervalSecondsRef.current = IntervalType.toSeconds(newInterval);
    clickedButton.classList.add("active");
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await axios.get(
        `http://127.0.0.1:8000/instruments/?ticker=APPL&interval=${currentInterval}`,
        {
          headers: { Authorization: `Bearer ${getCookie("jwt")}` },
        }
      );
      setCandlestickSeriesData(data);
      lastUpdateTimeRef.current = data[data.length - 1].time;
      candlestickSeriesDataRef.current = data;
    };
    fetchData();
  }, [currentInterval]);

  useEffect(() => {
    const renderChart = () => {
      try {
        const chartOptions: {
          autoSize: boolean;
          layout: LayoutOptions;
          grid: GridOptions;
          timeScale: TimeScaleOptions;
        } = {
          autoSize: true,
          layout: {
            background: {
              type: ColorType.Solid,
              color: getComputedStyle(
                document.documentElement
              ).getPropertyValue("--dark-secondary-bg-color"),
            },
            textColor: getComputedStyle(
              document.documentElement
            ).getPropertyValue("--dark-text-color"),
            fontSize: 12,
            fontFamily: getComputedStyle(
              document.documentElement
            ).getPropertyValue("font-family"),
            attributionLogo: false,
          },
          grid: {
            vertLines: { visible: false },
            horzLines: { visible: false },
          },
          timeScale: {
            timeVisible: true,
          },
        };

        const chartContainer = document.getElementById(
          "chart-container"
        ) as HTMLElement;
        chartContainer.innerHTML = "";
        chart = createChart(chartContainer!, chartOptions);
        candlestickSeriesRef.current = chart.addCandlestickSeries({
          upColor: "#26a69a",
          downColor: "#ef5350",
          borderVisible: false,
          wickUpColor: "#26a69a",
          wickDownColor: "#ef5350",
        });
        candlestickSeriesRef.current.setData(candlestickSeriesData);

        chart.timeScale().fitContent();
      } catch (e) {
        console.error(e);
      }
    };

    renderChart();
  }, [candlestickSeriesData]);

  /* --------------------
            Websocket
    -------------------- */
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const [alertType, setAlertType] = useState<AlertTypes | null>(null);
  const [alertMessage, setAlertMessage] = useState<string>("");
  const [alertCounter, setAlertCounter] = useState<number>(0);

  const displayAlert: (msg: string, msgType: AlertTypes) => void = (
    msg: string,
    msgType: AlertTypes
  ): void => {
    if (!msgType) {
      return;
    }
    setAlertMessage(msg);
    setAlertType(msgType);
    setAlertCounter((prev) => prev + 1);
  };

  const updateChartPrice = (data: Record<string, any>): void => {
    const newPrice = data.price;
    const newTime = data.time;

    if (candlestickSeriesRef.current) {
      let lastCandle =
        candlestickSeriesDataRef.current[
          candlestickSeriesDataRef.current.length - 1
        ];
      let existingCandle: Record<string, number> | any = lastCandle;
      const timespan = Math.floor(
        (newTime - lastCandle.time) / currentIntervalSecondsRef.current
      );
      let timePointer = lastCandle.time;

      if (timespan >= 1 && lastCandle) {
        const oldPrice = lastCandle.close;

        for (let i = 0; i < timespan; i++) {
          timePointer += currentIntervalSecondsRef.current;
          const newCandle: Record<string, number | null> = {
            time: timePointer,
            open: oldPrice,
            high: oldPrice,
            low: oldPrice,
            close: oldPrice,
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
      candlestickSeriesDataRef.current.push(newCandle);
      candlestickSeriesRef.current.update(newCandle);
    }
  };

  const addOrderToTable: (data: Record<string, any>) => void = (
    data: Record<string, any>
  ): void => {
    if (!data) {
      return;
    }

    setOpenOrderData((prev) => {
      let orders = [...prev];
      orders.push(data);
      return orders;
    });
  };

  const alterOrder: (data: Record<string, any>) => void = (
    data: Record<string, any>
  ): void => {
    setOpenOrderData((prev) => {
      if (data["order_status"] === "closed") {
        return [...prev].filter(
          (item) => item["order_id"] !== data["order_id"]
        );
      }

      return [...prev].map((order) => {
        if (order.order_id === data["order_id"]) {
          return data;
        }
        return order;
      });
    });
  };

  useEffect(() => {
    socketRef.current = new WebSocket("ws://127.0.0.1:8000/stream/trade");

    socketRef.current.onopen = (): void => {
      socketRef.current?.send(JSON.stringify({ token: getCookie("jwt") }));
      setIsConnected(true);
    };

    socketRef.current.onclose = (e): void => {
      setAlertMessage("Connection to server lost");
      setAlertType(AlertTypes.ERROR);
      setAlertCounter((prev) => prev + 1);
    };

    socketRef.current.onmessage = (e): void => {
      const socketMessage = JSON.parse(e.data);
      console.log("Socket msg: ", socketMessage);

      if (socketMessage?.category === SocketMessageCategory.PRICE) {
        updateChartPrice(socketMessage?.details);
        return;
      }

      if (socketMessage?.category === SocketMessageCategory.ORDER_UPDATE) {
        alterOrder(socketMessage.details);
        return;
      }

      if (socketMessage?.category === SocketMessageCategory.DOM) {
        setDomAsks(socketMessage.details["asks"]);
        setDomBids(socketMessage.details["bids"]);
        return;
      }

      displayAlert(
        socketMessage?.message,
        socketMessage?.category as AlertTypes
      );

      if (socketMessage?.category === SocketMessageCategory.ERROR) {
        return;
      }

      try {
        const actions: Record<string, (data: Record<string, any>) => void> = {
          [SocketMessageCategory.SUCCESS]: addOrderToTable,
          [SocketMessageCategory.ORDER_UPDATE]: alterOrder,
        };

        const category = socketMessage.category as SocketMessageCategory;
        if (category) {
          const action = actions[category];
          action(socketMessage.details);
        }
      } catch (e) {
        console.error(e);
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
  const [selectedOrderType, setSelectedOrderType] = useState<OrderType>(
    OrderType.MARKET_ORDER
  );

  const toggleOrderTypes = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    setShowOrderTypes(true);
    (e.target as HTMLElement).classList.add("active");
  };

  const disableOrderTypes = () => {
    (document.getElementById("orderType") as HTMLElement).classList.remove(
      "active"
    );
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

  const selectOrderType = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    const chosenOrderType = (e.target as HTMLButtonElement).value as OrderType;
    setSelectedOrderType(chosenOrderType);

    (document.getElementById("orderType") as HTMLElement).textContent =
      chosenOrderType
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    if (chosenOrderType == OrderType.LIMIT_ORDER) {
      enableLimitOptions(chosenOrderType);
    } else {
      disableLimitOptions(chosenOrderType);
    }
  };

  const formSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let payload: Record<string, any> = {};

    const orderData = Object.fromEntries(
      Array.from(new FormData(e.target as HTMLFormElement).entries())
        .filter(([_, v]) => v !== "")
        .map(([k, v]) => {
          if (["quantity", "limit_price"].includes(k)) {
            return [k, Number(v)];
          } else if (["take_profit", "stop_loss"].includes(k)) {
            return [k, { price: Number(v) }];
          }
          return [k, v];
        })
    );

    payload["type"] = selectedOrderType;
    payload[selectedOrderType] = orderData;

    if (isConnected && socketRef?.current) {
      socketRef.current.send(JSON.stringify(payload));
      (e.target as HTMLFormElement).reset();
    }
  };

  const orderIdRef = useRef<string>("");
  const modifyFormHandler = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (socketRef.current) {
      const data: Record<string, null | number | string> = Object.fromEntries(
        Array.from(new FormData(e.target as HTMLFormElement).entries()).map(
          ([k, v]) => [k, parseFloat(v as string) || null]
        )
      );
      data["order_id"] = orderIdRef.current;
      socketRef.current.send(
        JSON.stringify({ type: "modify_order", modify_order: data })
      );
      (e.target as HTMLFormElement).reset();
      (
        document.querySelector(".modify-order-card") as HTMLElement
      ).style.display = "none";
    }
  };

  const [openOrderData, setOpenOrderData] = useState<
    Array<Record<string, null | number | string>>
  >([]);
  const [domAsks, setDomAsks] = useState<Record<number, number>>({});
  const [domBids, setDomBids] = useState<Record<number, number>>({});

  useEffect(() => {
    const fetchTableData = async () => {
      try {
        const { data } = await axios.get(
          `http://127.0.0.1:8000/portfolio/orders?${[
            "filled",
            "partially_closed_active",
          ]
            .map((item) => `order_status=${item}`)
            .join("&")}`,
          { headers: { Authorization: `Bearer ${getCookie("jwt")}` } }
        );
        setOpenOrderData(data);
      } catch (e) {
        console.error("Table Fetch Error: ", e);
      }
    };

    fetchTableData();
  }, []);

  /* --------------------
        Return Content
    -------------------- */

  return (
    <Sidebar
      mainContent={
        <>
          <Alert
            message={alertMessage}
            type={alertType}
            counter={alertCounter}
          />
          <DashboardLayout
            leftContent={
              <>
                <div className="chart-card card">
                  <div className="btn-container">
                    {Object.values(IntervalEnum).map((value) => (
                      <button
                        key={value}
                        className={`btn btn-secondary ${
                          value === "1m" ? "active" : ""
                        }`}
                        value={value}
                        onClick={changeTimeFrame}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <div className="chart-container">
                    <div id="chart-container" className="chart"></div>
                  </div>
                  <div className="card-footer"></div>
                </div>
                <OrderTable
                  showClosed={false}
                  openOrders={openOrderData}
                  orderIdRef={orderIdRef}
                  formSubmissionHandler={modifyFormHandler}
                />
              </>
            }
            rightContent={
              <>
                <div className="card">
                  <form id="orderForm" onSubmit={formSubmit}>
                    <input
                      type="text"
                      name="ticker"
                      placeholder="Ticker"
                      value="APPL"
                      pattern="[A-Za-z]+"
                      readOnly
                    />
                    <input
                      type="number"
                      name="quantity"
                      placeholder="Quantity"
                      required
                    />
                    <input
                      type="number"
                      name="take_profit"
                      placeholder="Take Profit"
                    />
                    <input
                      type="number"
                      name="stop_loss"
                      placeholder="Stop Loss"
                    />
                    <button
                      type="button"
                      id="orderType"
                      className="container"
                      onClick={toggleOrderTypes}
                    >
                      Market Order
                    </button>
                    <div
                      className="options-container container"
                      style={{ display: showOrderTypes ? "block" : "none" }}
                    >
                      <div className="option">
                        <button
                          onClick={selectOrderType}
                          type="button"
                          value={OrderType.MARKET_ORDER}
                        >
                          Market Order
                        </button>
                      </div>
                      <div className="option">
                        <button
                          onClick={selectOrderType}
                          type="button"
                          value={OrderType.LIMIT_ORDER}
                        >
                          Limit Order
                        </button>
                      </div>
                      <div className="option">
                        <button
                          onClick={selectOrderType}
                          type="button"
                          value={OrderType.CLOSE_ORDER}
                        >
                          Close Order
                        </button>
                      </div>
                    </div>
                    <div
                      className="container limit-options"
                      style={{ display: showLimitOptions ? "block" : "none" }}
                    >
                      <input
                        type="number"
                        name="limit_price"
                        placeholder="Limit Price"
                        required={showLimitOptions}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary">
                      Open Order
                    </button>
                  </form>
                </div>
                <DOM asks={domAsks} bids={domBids} />
              </>
            }
          />
        </>
      }
    />
  );
};

export default Trade;
