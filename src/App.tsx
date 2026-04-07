import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MenuProvider } from './context/MenuContext';
import { CartProvider } from './context/CartContext';
import Header from './components/Header';
import MenuList from './components/MenuList';
import Cart from './components/Cart';
import Footer from './components/Footer';
import Admin from './pages/Admin';
import ScannerEnCaminoPage from './pages/ScannerEnCaminoPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin" element={
          <MenuProvider>
            <CartProvider>
              <Admin />
            </CartProvider>
          </MenuProvider>
        } />
        <Route path="/scan" element={<ScannerEnCaminoPage />} />

        {/* ----------------------- */}

        <Route path="/" element={
          <MenuProvider>
            <CartProvider>
              <div className="min-h-screen flex flex-col bg-gray-50">
                <Header />
                <main className="flex-grow">
                  <MenuList />
                </main>
                <Cart />
                <Footer />
              </div>
            </CartProvider>
          </MenuProvider>
        } />
      </Routes>
    </Router>
  );
}

export default App;