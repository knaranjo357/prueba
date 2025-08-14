import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MenuProvider } from './context/MenuContext';
import { CartProvider } from './context/CartContext';
import Header from './components/Header';
import MenuList from './components/MenuList';
import Cart from './components/Cart';
import Footer from './components/Footer';
import Kitchen from './pages/Kitchen';
import Despacho from './pages/Despacho';
import Admin from './pages/Admin';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/kitchen" element={<Kitchen />} />
        <Route path="/despacho" element={<Despacho />} />
        <Route path="/admin" element={<Admin />} />
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