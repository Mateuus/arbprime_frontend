const ChangePassword = () => {
    return (
      <div className="text-white space-y-6">
        <h1 className="text-2xl font-bold">Trocar Senha</h1>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Nome</label>
            <input className="bg-gray-800 w-full p-2 rounded mt-1" value="Matêus" readOnly />
          </div>
          <div>
            <label className="text-sm">Sobrenome</label>
            <input className="bg-gray-800 w-full p-2 rounded mt-1" value="Rodrigues Santana" readOnly />
          </div>
          <div>
            <label className="text-sm">Email</label>
            <input className="bg-gray-800 w-full p-2 rounded mt-1" value="seuemail@email.com" readOnly />
          </div>
          <div>
            <label className="text-sm">CPF</label>
            <input className="bg-gray-800 w-full p-2 rounded mt-1" value="000.000.000-00" readOnly />
          </div>
        </div>
      </div>
    );
  };
  
  export default ChangePassword;